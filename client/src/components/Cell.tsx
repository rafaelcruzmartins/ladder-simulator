/**
 * Cell Component
 * 
 * Represents a single cell in the ladder grid.
 * Allows selection, editing, and visual representation of different cell types.
 */

import { CellType, GridCell, Variable } from "@/engine/types";
import { useState } from "react";
import "./Cell.css";

interface CellProps {
  cell: GridCell;
  row: number;
  col: number;
  variables: Variable[];
  onCellChange: (row: number, col: number, newCell: GridCell) => void;
}

const CELL_TYPES: CellType[] = [
  "empty",
  "wire_h",
  "wire_v",
  "contact_no",
  "contact_nc",
  "coil",
  "coil_set",
  "coil_reset",
  "timer_ton",
  "timer_tof",
];

const CELL_LABELS: Record<CellType, string> = {
  empty: "Empty",
  wire_h: "Wire H",
  wire_v: "Wire V",
  contact_no: "Contact NO",
  contact_nc: "Contact NC",
  coil: "Coil",
  coil_set: "Coil Set",
  coil_reset: "Coil Reset",
  timer_ton: "Timer TON",
  timer_tof: "Timer TOF",
};

export default function Cell({
  cell,
  row,
  col,
  variables,
  onCellChange,
}: CellProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showVarMenu, setShowVarMenu] = useState(false);

  const handleTypeChange = (newType: CellType) => {
    const newCell: GridCell = {
      ...cell,
      type: newType,
      // Clear variable if switching to a type that doesn't use variables
      variableId:
        [
          "contact_no",
          "contact_nc",
          "coil",
          "coil_set",
          "coil_reset",
          "timer_ton",
          "timer_tof",
        ].includes(newType) && cell.variableId
          ? cell.variableId
          : undefined,
    };
    onCellChange(row, col, newCell);
    setShowMenu(false);
  };

  const handleVariableChange = (variableId: string) => {
    const newCell: GridCell = {
      ...cell,
      variableId,
    };
    onCellChange(row, col, newCell);
    setShowVarMenu(false);
  };

  const handlePresetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const preset = parseInt(e.target.value) || 0;
    const newCell: GridCell = {
      ...cell,
      timerPreset: preset,
    };
    onCellChange(row, col, newCell);
  };

  const needsVariable = [
    "contact_no",
    "contact_nc",
    "coil",
    "coil_set",
    "coil_reset",
    "timer_ton",
    "timer_tof",
  ].includes(cell.type);

  const needsPreset = ["timer_ton", "timer_tof"].includes(cell.type);

  const selectedVariable = variables.find((v) => v.id === cell.variableId);

  return (
    <div className="cell-container">
      <div
        className={`cell cell-${cell.type}`}
        onClick={() => setShowMenu(!showMenu)}
        title={`${CELL_LABELS[cell.type]} (Row ${row}, Col ${col})`}
      >
        <div className="cell-content">
          {cell.type === "empty" && <span className="cell-label">—</span>}
          {cell.type === "wire_h" && <span className="cell-label">—</span>}
          {cell.type === "wire_v" && <span className="cell-label">|</span>}
          {cell.type === "contact_no" && (
            <span className="cell-label">NO</span>
          )}
          {cell.type === "contact_nc" && (
            <span className="cell-label">NC</span>
          )}
          {cell.type === "coil" && <span className="cell-label">( )</span>}
          {cell.type === "coil_set" && <span className="cell-label">(S)</span>}
          {cell.type === "coil_reset" && (
            <span className="cell-label">(R)</span>
          )}
          {cell.type === "timer_ton" && (
            <span className="cell-label">TON</span>
          )}
          {cell.type === "timer_tof" && (
            <span className="cell-label">TOF</span>
          )}
        </div>
        {selectedVariable && (
          <div className="cell-var-label">{selectedVariable.name}</div>
        )}
      </div>

      {showMenu && (
        <div className="cell-menu">
          <div className="cell-menu-header">Cell Type</div>
          {CELL_TYPES.map((type) => (
            <button
              key={type}
              className={`cell-menu-item ${cell.type === type ? "active" : ""}`}
              onClick={() => handleTypeChange(type)}
            >
              {CELL_LABELS[type]}
            </button>
          ))}

          {needsVariable && (
            <>
              <div className="cell-menu-header">Variable</div>
              <button
                className="cell-menu-item"
                onClick={() => setShowVarMenu(!showVarMenu)}
              >
                {selectedVariable ? selectedVariable.name : "Select Variable"}
              </button>
              {showVarMenu && (
                <div className="cell-submenu">
                  {variables.map((variable) => (
                    <button
                      key={variable.id}
                      className={`cell-menu-item ${
                        cell.variableId === variable.id ? "active" : ""
                      }`}
                      onClick={() => handleVariableChange(variable.id)}
                    >
                      {variable.name} ({variable.type})
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {needsPreset && (
            <>
              <div className="cell-menu-header">Preset (ms)</div>
              <input
                type="number"
                min="0"
                step="10"
                value={cell.timerPreset || 0}
                onChange={handlePresetChange}
                className="cell-preset-input"
                onClick={(e) => e.stopPropagation()}
              />
            </>
          )}

          <button
            className="cell-menu-item cell-menu-close"
            onClick={() => setShowMenu(false)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
