/**
 * Ladder Logic Simulator - Type Definitions
 * 
 * This module defines all core types used throughout the simulator:
 * - Grid cells and their content types
 * - Variables (inputs, outputs, memory)
 * - Timers (TON, TOF)
 * - Project structure
 * - Execution state
 */

/**
 * Cell content types that can appear in the ladder grid
 */
export type CellType =
  | "empty"
  | "wire_h"           // Horizontal wire
  | "wire_v"           // Vertical wire
  | "contact_no"       // Normally open contact (series connection)
  | "contact_nc"       // Normally closed contact (series connection)
  | "coil"             // Output coil
  | "coil_set"         // Set coil (SR latch - set)
  | "coil_reset"       // Reset coil (SR latch - reset)
  | "timer_ton"        // Timer on-delay (accumulates time while energized)
  | "timer_tof";       // Timer off-delay (accumulates time while de-energized)

/**
 * Variable types in the system
 */
export type VariableType = "input" | "output" | "memory";

/**
 * A grid cell in the ladder diagram
 */
export interface GridCell {
  type: CellType;
  variableId?: string;  // Reference to a variable (for contacts, coils, timers)
  timerPreset?: number; // Preset value in milliseconds (for timers)
}

/**
 * A variable in the system (input, output, or memory)
 */
export interface Variable {
  id: string;
  name: string;
  type: VariableType;
  value: boolean;
}

/**
 * Timer state tracking
 */
export interface TimerState {
  variableId: string;
  type: "TON" | "TOF";
  preset: number;           // Preset value in milliseconds
  accumulated: number;      // Current accumulated time in milliseconds
  enabled: boolean;         // Whether the timer is currently running
  done: boolean;            // Timer done bit (set when accumulated >= preset)
}

/**
 * A rung in the ladder diagram (horizontal line of logic)
 */
export interface Rung {
  id: string;
  cells: GridCell[][];  // 2D grid: cells[row][col]
}

/**
 * Complete project structure
 */
export interface Project {
  id: string;
  name: string;
  scanCycleMs: number;      // Scan cycle time in milliseconds (e.g., 50ms)
  variables: Variable[];
  rungs: Rung[];
  timers: TimerState[];
}

/**
 * Energized cells map: rung index -> set of "row-col" keys
 */
export interface EnergizedCellsMap {
  [rungIndex: number]: Set<string>;
}

/**
 * Execution state for the simulator
 */
export interface ExecutionState {
  variables: Variable[];
  timers: TimerState[];
  isRunning: boolean;
  lastScanTime: number;
  energizedCells: EnergizedCellsMap;  // Track which cells are energized
}

/**
 * Result of evaluating a rung
 */
export interface RungEvaluationResult {
  energized: boolean;
  variables: Variable[];
  timers: TimerState[];
  energizedCells: Set<string>;  // "row-col" format
}
