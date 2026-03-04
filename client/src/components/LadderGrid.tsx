/**
 * LadderGrid Component
 * 
 * Displays and allows editing of the ladder logic grid.
 * Shows all rungs and their cells in a visual ladder format.
 */

import { GridCell, Project, Rung, Variable } from "@/engine/types";
import Cell from "./Cell";
import "./LadderGrid.css";

interface LadderGridProps {
  project: Project;
  onProjectChange: (project: Project) => void;
}

export default function LadderGrid({ project, onProjectChange }: LadderGridProps) {
  const handleCellChange = (
    rungIndex: number,
    row: number,
    col: number,
    newCell: GridCell
  ) => {
    const newRungs = project.rungs.map((rung, idx) => {
      if (idx === rungIndex) {
        const newCells = rung.cells.map((cellRow, rowIdx) => {
          if (rowIdx === row) {
            return cellRow.map((cell, colIdx) => {
              if (colIdx === col) {
                return newCell;
              }
              return cell;
            });
          }
          return cellRow;
        });
        return { ...rung, cells: newCells };
      }
      return rung;
    });

    onProjectChange({ ...project, rungs: newRungs });
  };

  const addRung = () => {
    const newRung: Rung = {
      id: `rung_${Date.now()}`,
      cells: Array(1)
        .fill(null)
        .map(() =>
          Array(10)
            .fill(null)
            .map(() => ({ type: "empty" as const }))
        ),
    };
    onProjectChange({ ...project, rungs: [...project.rungs, newRung] });
  };

  const deleteRung = (rungIndex: number) => {
    const newRungs = project.rungs.filter((_, idx) => idx !== rungIndex);
    onProjectChange({ ...project, rungs: newRungs });
  };

  const addRowToRung = (rungIndex: number) => {
    const newRungs = project.rungs.map((rung, idx) => {
      if (idx === rungIndex) {
        const newRow = Array(rung.cells[0]?.length || 10)
          .fill(null)
          .map(() => ({ type: "empty" as const }));
        return { ...rung, cells: [...rung.cells, newRow] };
      }
      return rung;
    });
    onProjectChange({ ...project, rungs: newRungs });
  };

  const addColToRung = (rungIndex: number) => {
    const newRungs = project.rungs.map((rung, idx) => {
      if (idx === rungIndex) {
        const newCells = rung.cells.map((row) => [
          ...row,
          { type: "empty" as const },
        ]);
        return { ...rung, cells: newCells };
      }
      return rung;
    });
    onProjectChange({ ...project, rungs: newRungs });
  };

  return (
    <div className="ladder-grid-container">
      <div className="ladder-grid-header">
        <h2>Ladder Diagram Editor</h2>
        <button onClick={addRung} className="btn btn-primary">
          + Add Rung
        </button>
      </div>

      <div className="ladder-grid">
        {project.rungs.length === 0 ? (
          <div className="empty-state">
            <p>No rungs yet. Click "Add Rung" to start.</p>
          </div>
        ) : (
          project.rungs.map((rung, rungIndex) => (
            <div key={rung.id} className="rung-container">
              <div className="rung-header">
                <span>Rung {rungIndex + 1}</span>
                <div className="rung-actions">
                  <button
                    onClick={() => addRowToRung(rungIndex)}
                    className="btn btn-small"
                    title="Add parallel branch"
                  >
                    + Row
                  </button>
                  <button
                    onClick={() => addColToRung(rungIndex)}
                    className="btn btn-small"
                    title="Add column"
                  >
                    + Col
                  </button>
                  <button
                    onClick={() => deleteRung(rungIndex)}
                    className="btn btn-small btn-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="rung-grid">
                {rung.cells.map((row, rowIndex) => (
                  <div key={`row-${rowIndex}`} className="rung-row">
                    {row.map((cell, colIndex) => (
                      <div key={`cell-${colIndex}`} className="rung-cell">
                        <Cell
                          cell={cell}
                          row={rowIndex}
                          col={colIndex}
                          variables={project.variables}
                          onCellChange={(r, c, newCell) =>
                            handleCellChange(rungIndex, r, c, newCell)
                          }
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
