/**
 * Ladder Logic Simulator - Execution Engine (v4)
 * 
 * Fixed propagation model with energized cell tracking:
 * - Left rail is always energized (virtual source)
 * - Energy propagates right through conducting cells
 * - Coils are energized if energy reaches them
 * - Returns which cells are energized for visualization
 */

import {
  CellType,
  EnergizedCellsMap,
  ExecutionState,
  GridCell,
  Project,
  Rung,
  RungEvaluationResult,
  TimerState,
  Variable,
} from "./types";

/**
 * Check if a cell conducts energy (used during propagation)
 */
function canConductEnergy(
  cell: GridCell,
  variables: Variable[],
  timers: TimerState[]
): boolean {
  switch (cell.type) {
    case "empty":
    case "wire_h":
    case "wire_v":
      // Wires and empty cells are transparent
      return true;

    case "contact_no": {
      // Normally open: conducts if variable is TRUE
      if (!cell.variableId) return false;
      const variable = variables.find((v) => v.id === cell.variableId);
      return variable?.value ?? false;
    }

    case "contact_nc": {
      // Normally closed: conducts if variable is FALSE
      if (!cell.variableId) return false;
      const variable = variables.find((v) => v.id === cell.variableId);
      return !(variable?.value ?? false);
    }

    case "coil":
    case "coil_set":
    case "coil_reset":
      // Coils don't conduct, they consume energy
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
 * Propagate energy through a single row (left to right)
 * Returns which columns are energized
 */
function propagateRowEnergy(
  row: GridCell[],
  variables: Variable[],
  timers: TimerState[]
): { energized: Set<number>; reachesEnd: boolean } {
  const energized = new Set<number>();
  let currentlyEnergized = true; // Left rail is always energized

  for (let col = 0; col < row.length; col++) {
    const cell = row[col];

    if (currentlyEnergized) {
      // Energy is flowing, check if this cell conducts
      if (canConductEnergy(cell, variables, timers)) {
        energized.add(col);
      } else {
        // Energy stops here (coil or blocked contact)
        currentlyEnergized = false;
      }
    }
  }

  return {
    energized,
    reachesEnd: currentlyEnergized,
  };
}

/**
 * Evaluate a single rung using row-by-row energy propagation
 */
function evaluateRung(
  rung: Rung,
  variables: Variable[],
  timers: TimerState[]
): RungEvaluationResult {
  let updatedVariables = [...variables];
  const updatedTimers = [...timers];
  const energizedCells = new Set<string>();

  const rows = rung.cells.length;
  const cols = rung.cells[0]?.length ?? 0;

  // Track which cells are energized
  const cellEnergized: boolean[][] = Array(rows)
    .fill(null)
    .map(() => Array(cols).fill(false));

  // Determine rung energization (OR of all rows)
  let rungEnergized = false;

  // Propagate energy through each row
  for (let r = 0; r < rows; r++) {
    const row = rung.cells[r];
    const { energized, reachesEnd } = propagateRowEnergy(
      row,
      updatedVariables,
      updatedTimers
    );

    // Mark energized cells in this row
    energized.forEach((col) => {
      cellEnergized[r][col] = true;
      energizedCells.add(`${r}-${col}`);
    });

    // Rung is energized if any row reaches the end
    if (reachesEnd) {
      rungEnergized = true;
    }
  }

  // Process coils based on energized cells
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = rung.cells[r][c];
      const isEnergized = cellEnergized[r][c];

      // Check if energy reaches this cell (it's energized AND it's a coil)
      if (!cell.variableId) continue;

      // Energy reaches a coil if the cell before it is energized
      // OR if it's the first cell and left rail is energized
      const energyReachesCoil =
        c === 0 || cellEnergized[r][c - 1] || (c === 0 && true);

      switch (cell.type) {
        case "coil": {
          // Regular coil: set to energization state
          const varIndex = updatedVariables.findIndex(
            (v) => v.id === cell.variableId
          );
          if (varIndex >= 0) {
            updatedVariables[varIndex] = {
              ...updatedVariables[varIndex],
              value: energyReachesCoil,
            };
          }
          // Mark coil as energized if it's being set
          if (energyReachesCoil) {
            energizedCells.add(`${r}-${c}`);
          }
          break;
        }

        case "coil_set": {
          // Set coil: set to TRUE if energized
          if (energyReachesCoil) {
            const varIndex = updatedVariables.findIndex(
              (v) => v.id === cell.variableId
            );
            if (varIndex >= 0) {
              updatedVariables[varIndex] = {
                ...updatedVariables[varIndex],
                value: true,
              };
            }
            energizedCells.add(`${r}-${c}`);
          }
          break;
        }

        case "coil_reset": {
          // Reset coil: set to FALSE if energized
          if (energyReachesCoil) {
            const varIndex = updatedVariables.findIndex(
              (v) => v.id === cell.variableId
            );
            if (varIndex >= 0) {
              updatedVariables[varIndex] = {
                ...updatedVariables[varIndex],
                value: false,
              };
            }
            energizedCells.add(`${r}-${c}`);
          }
          break;
        }

        case "timer_ton":
        case "timer_tof": {
          // Timer coil: energize based on cell state
          const varIndex = updatedVariables.findIndex(
            (v) => v.id === cell.variableId
          );
          if (varIndex >= 0) {
            updatedVariables[varIndex] = {
              ...updatedVariables[varIndex],
              value: energyReachesCoil,
            };
          }
          if (energyReachesCoil) {
            energizedCells.add(`${r}-${c}`);
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
    energizedCells,
  };
}

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
 * Execute a single scan cycle
 * 
 * Scan cycle steps:
 * 1. Snapshot input states
 * 2. Execute rungs sequentially with energy propagation
 * 3. Update timer states
 * 4. Return new execution state with energized cells
 */
export function simulateScan(
  project: Project,
  currentState: ExecutionState,
  deltaMs: number
): ExecutionState {
  let variables = [...currentState.variables];
  let timers = [...currentState.timers];
  const energizedCells: EnergizedCellsMap = {};

  // Step 1: Snapshot inputs (already done in currentState)

  // Step 2: Execute each rung sequentially
  for (let rungIdx = 0; rungIdx < project.rungs.length; rungIdx++) {
    const rung = project.rungs[rungIdx];
    const result = evaluateRung(rung, variables, timers);
    variables = result.variables;
    timers = result.timers;
    energizedCells[rungIdx] = result.energizedCells;
  }

  // Step 3: Update timer states
  timers = updateTimers(timers, variables, deltaMs);

  return {
    variables,
    timers,
    isRunning: currentState.isRunning,
    lastScanTime: Date.now(),
    energizedCells,
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
    energizedCells: {},
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
