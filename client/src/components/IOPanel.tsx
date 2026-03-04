/**
 * IOPanel Component
 * 
 * Displays and manages:
 * - Input variables (buttons for manual control)
 * - Output variables (LED indicators)
 * - Memory variables (state display)
 */

import { ExecutionState, Project, Variable } from "@/engine/types";
import "./IOPanel.css";

interface IOPanelProps {
  project: Project;
  executionState: ExecutionState;
  onInputChange: (variableId: string, value: boolean) => void;
  onAddVariable: (type: "input" | "output" | "memory") => void;
  onDeleteVariable: (variableId: string) => void;
}

export default function IOPanel({
  project,
  executionState,
  onInputChange,
  onAddVariable,
  onDeleteVariable,
}: IOPanelProps) {
  const inputs = project.variables.filter((v) => v.type === "input");
  const outputs = project.variables.filter((v) => v.type === "output");
  const memory = project.variables.filter((v) => v.type === "memory");

  const getVariableValue = (variableId: string): boolean => {
    return executionState.variables.find((v) => v.id === variableId)?.value ?? false;
  };

  const renderVariableList = (
    variables: Variable[],
    type: "input" | "output" | "memory"
  ) => {
    if (variables.length === 0) {
      return (
        <div className="empty-list">
          <p>No {type} variables</p>
        </div>
      );
    }

    return (
      <div className="variable-list">
        {variables.map((variable) => {
          const value = getVariableValue(variable.id);

          return (
            <div key={variable.id} className={`variable-item variable-${type}`}>
              {type === "input" && (
                <>
                  <button
                    className={`input-button ${value ? "pressed" : ""}`}
                    onClick={() => onInputChange(variable.id, !value)}
                    title={`Toggle ${variable.name}`}
                  >
                    {variable.name}
                  </button>
                  <span className={`input-state ${value ? "on" : "off"}`}>
                    {value ? "ON" : "OFF"}
                  </span>
                </>
              )}

              {type === "output" && (
                <>
                  <span className="output-label">{variable.name}</span>
                  <div className={`led ${value ? "on" : "off"}`}></div>
                </>
              )}

              {type === "memory" && (
                <>
                  <span className="memory-label">{variable.name}</span>
                  <span className={`memory-value ${value ? "on" : "off"}`}>
                    {value ? "1" : "0"}
                  </span>
                </>
              )}

              <button
                className="btn-delete"
                onClick={() => onDeleteVariable(variable.id)}
                title="Delete variable"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="io-panel">
      <div className="io-section">
        <div className="io-section-header">
          <h3>Digital Inputs</h3>
          <button
            className="btn-add"
            onClick={() => onAddVariable("input")}
            title="Add input variable"
          >
            + Add
          </button>
        </div>
        {renderVariableList(inputs, "input")}
      </div>

      <div className="io-section">
        <div className="io-section-header">
          <h3>Digital Outputs</h3>
          <button
            className="btn-add"
            onClick={() => onAddVariable("output")}
            title="Add output variable"
          >
            + Add
          </button>
        </div>
        {renderVariableList(outputs, "output")}
      </div>

      <div className="io-section">
        <div className="io-section-header">
          <h3>Memory</h3>
          <button
            className="btn-add"
            onClick={() => onAddVariable("memory")}
            title="Add memory variable"
          >
            + Add
          </button>
        </div>
        {renderVariableList(memory, "memory")}
      </div>

      <div className="io-stats">
        <div className="stat">
          <span className="stat-label">Total Variables:</span>
          <span className="stat-value">{project.variables.length}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Scan Cycle:</span>
          <span className="stat-value">{project.scanCycleMs}ms</span>
        </div>
      </div>
    </div>
  );
}
