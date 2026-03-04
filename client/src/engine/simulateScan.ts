/**
 * Ladder Logic Simulator - Execution Engine
 * 
 * This module implements the core PLC simulation logic:
 * - Scan cycle execution
 * - Rung evaluation (series/parallel logic)
 * - Timer management (TON, TOF)
 * - Variable state management
 */

import {
  CellType,
  ExecutionState,
  GridCell,
  Project,
  Rung,
  RungEvaluationResult,
  TimerState,
  Variable,
} from "./types";

/**
 * Update timer states based on elapsed time and energization status
 */
function updateTimers(
  timers: TimerState[],
  variables: Variable[],
  deltaMs: number
): TimerState[] {
  return timers.map((timer) => {
    const timerVar = variables.find((v) => v.id === timer.variableId);
    if (!timerVar) return timer;

    let newAccumulated = timer.accumulated;
    let newEnabled = timer.enabled;
    let newDone = timer.done;

    if (timer.type === "TON") {
      // TON (On-Delay): accumulates while energized
      if (timerVar.value) {
        newAccumulated += deltaMs;
        newEnabled = true;
      } else {
        newAccumulated = 0;
        newEnabled = false;
      }
    } else if (timer.type === "TOF") {
      // TOF (Off-Delay): accumulates while de-energized
      if (timerVar.value) {
        newAccumulated = 0;
        newEnabled = false;
      } else {
        newAccumulated += deltaMs;
        newEnabled = true;
      }
    }

    // Set done bit when accumulated >= preset
    newDone = newAccumulated >= timer.preset;

    return {
      ...timer,
      accumulated: newAccumulated,
      enabled: newEnabled,
      done: newDone,
    };
  });
}

/**
 * Evaluate a single cell in the ladder grid
 * Returns true if the cell conducts energy (is energized)
 */
function evaluateCell(
  cell: GridCell,
  variables: Variable[],
  timers: TimerState[]
): boolean {
  switch (cell.type) {
    case "empty":
    case "wire_h":
    case "wire_v":
      // Wires and empty cells are transparent (pass through energy)
      return true;

    case "contact_no": {
      // Normally open contact: conducts if variable is TRUE
      if (!cell.variableId) return false;
      const variable = variables.find((v) => v.id === cell.variableId);
      return variable?.value ?? false;
    }

    case "contact_nc": {
      // Normally closed contact: conducts if variable is FALSE
      if (!cell.variableId) return false;
      const variable = variables.find((v) => v.id === cell.variableId);
      return !(variable?.value ?? false);
    }

    case "coil":
    case "coil_set":
    case "coil_reset":
      // Coils don't conduct energy, they consume it
      return false;

    case "timer_ton":
    case "timer_tof": {
      // Timer contacts: conduct if timer done bit is set
      if (!cell.variableId) return false;
      const timer = timers.find((t) => t.variableId === cell.variableId);
      return timer?.done ?? false;
    }

    default:
      return false;
  }
}

/**
 * Evaluate a horizontal line (series connection) in the ladder
 * All cells must conduct for the line to be energized
 */
function evaluateHorizontalLine(
  cells: GridCell[],
  variables: Variable[],
  timers: TimerState[]
): boolean {
  // Empty line conducts energy
  if (cells.length === 0) return true;

  // All cells in series must conduct
  return cells.every((cell) => evaluateCell(cell, variables, timers));
}

/**
 * Evaluate a rung (horizontal branch of the ladder)
 * Handles parallel branches (multiple paths from left to right)
 */
function evaluateRung(
  rung: Rung,
  variables: Variable[],
  timers: TimerState[]
): RungEvaluationResult {
  const updatedVariables = [...variables];
  const updatedTimers = [...timers];

  // For now, we treat each row as a series path
  // Multiple rows represent parallel branches
  let rungEnergized = false;

  // Evaluate each row (parallel branch)
  for (const row of rung.cells) {
    const rowEnergized = evaluateHorizontalLine(row, updatedVariables, updatedTimers);
    rungEnergized = rungEnergized || rowEnergized;
  }

  // Process coils in the rung
  for (const row of rung.cells) {
    for (const cell of row) {
      if (!cell.variableId) continue;

      switch (cell.type) {
        case "coil": {
          // Regular coil: set to rung energization state
          const varIndex = updatedVariables.findIndex(
            (v) => v.id === cell.variableId
          );
          if (varIndex >= 0) {
            updatedVariables[varIndex] = {
              ...updatedVariables[varIndex],
              value: rungEnergized,
            };
          }
          break;
        }

        case "coil_set": {
          // Set coil: set to TRUE if rung is energized
          if (rungEnergized) {
            const varIndex = updatedVariables.findIndex(
              (v) => v.id === cell.variableId
            );
            if (varIndex >= 0) {
              updatedVariables[varIndex] = {
                ...updatedVariables[varIndex],
                value: true,
              };
            }
          }
          break;
        }

        case "coil_reset": {
          // Reset coil: set to FALSE if rung is energized
          if (rungEnergized) {
            const varIndex = updatedVariables.findIndex(
              (v) => v.id === cell.variableId
            );
            if (varIndex >= 0) {
              updatedVariables[varIndex] = {
                ...updatedVariables[varIndex],
                value: false,
              };
            }
          }
          break;
        }

        case "timer_ton":
        case "timer_tof": {
          // Timer coil: energize the timer
          const timerIndex = updatedTimers.findIndex(
            (t) => t.variableId === cell.variableId
          );
          if (timerIndex >= 0) {
            updatedTimers[timerIndex] = {
              ...updatedTimers[timerIndex],
              // Timer variable is set to rung energization state
            };
            // Update the corresponding variable for the timer
            const varIndex = updatedVariables.findIndex(
              (v) => v.id === cell.variableId
            );
            if (varIndex >= 0) {
              updatedVariables[varIndex] = {
                ...updatedVariables[varIndex],
                value: rungEnergized,
              };
            }
          }
          break;
        }
      }
    }
  }

  return {
    energized: rungEnergized,
    variables: updatedVariables,
    timers: updatedTimers,
  };
}

/**
 * Execute a single scan cycle
 * 
 * Scan cycle steps:
 * 1. Snapshot input states
 * 2. Execute rungs sequentially
 * 3. Update timer states
 * 4. Return new execution state
 */
export function simulateScan(
  project: Project,
  currentState: ExecutionState,
  deltaMs: number
): ExecutionState {
  let variables = [...currentState.variables];
  let timers = [...currentState.timers];

  // Step 1: Snapshot inputs (already done in currentState)

  // Step 2: Execute each rung sequentially
  for (const rung of project.rungs) {
    const result = evaluateRung(rung, variables, timers);
    variables = result.variables;
    timers = result.timers;
  }

  // Step 3: Update timer states
  timers = updateTimers(timers, variables, deltaMs);

  return {
    variables,
    timers,
    isRunning: currentState.isRunning,
    lastScanTime: Date.now(),
  };
}

/**
 * Initialize execution state from project
 */
export function initializeExecutionState(project: Project): ExecutionState {
  return {
    variables: [...project.variables],
    timers: [...project.timers],
    isRunning: false,
    lastScanTime: Date.now(),
  };
}

/**
 * Create a new timer state
 */
export function createTimer(
  variableId: string,
  type: "TON" | "TOF",
  preset: number
): TimerState {
  return {
    variableId,
    type,
    preset,
    accumulated: 0,
    enabled: false,
    done: false,
  };
}

/**
 * Create a new variable
 */
export function createVariable(
  id: string,
  name: string,
  type: "input" | "output" | "memory"
): Variable {
  return {
    id,
    name,
    type,
    value: false,
  };
}

/**
 * Create a new rung
 */
export function createRung(rows: number, cols: number): Rung {
  return {
    id: `rung_${Date.now()}`,
    cells: Array(rows)
      .fill(null)
      .map(() =>
        Array(cols)
          .fill(null)
          .map(() => ({ type: "empty" as CellType }))
      ),
  };
}
