import { useEffect, useRef, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import LadderGrid from "@/components/LadderGrid";
import IOPanel from "@/components/IOPanel";
import {
  createRung,
  createTimer,
  createVariable,
  initializeExecutionState,
  simulateScan,
} from "@/engine/simulateScan";
import { ExecutionState, Project, Variable } from "@/engine/types";
import "./App.css";

/**
 * Default example project with improved test cases
 */
function createDefaultProject(): Project {
  return {
    id: "default_project",
    name: "Ladder Logic Test Suite",
    scanCycleMs: 50,
    variables: [
      createVariable("input_1", "Button A", "input"),
      createVariable("input_2", "Button B", "input"),
      createVariable("output_1", "LED 1", "output"),
      createVariable("output_2", "LED 2", "output"),
      createVariable("output_3", "LED 3", "output"),
      createVariable("memory_1", "Memory Bit", "memory"),
    ],
    rungs: [
      // Rung 1: Simple contact -> coil
      // Button A (NO contact) -> LED 1
      {
        id: "rung_1",
        cells: [
          [
            { type: "contact_no", variableId: "input_1" },
            { type: "wire_h" },
            { type: "coil", variableId: "output_1" },
            { type: "empty" },
            { type: "empty" },
            { type: "empty" },
            { type: "empty" },
            { type: "empty" },
            { type: "empty" },
            { type: "empty" },
          ],
        ],
      },

      // Rung 2: NC contact (normally closed)
      // NOT Button B -> LED 2
      {
        id: "rung_2",
        cells: [
          [
            { type: "contact_nc", variableId: "input_2" },
            { type: "wire_h" },
            { type: "coil", variableId: "output_2" },
            { type: "empty" },
            { type: "empty" },
            { type: "empty" },
            { type: "empty" },
            { type: "empty" },
            { type: "empty" },
            { type: "empty" },
          ],
        ],
      },

      // Rung 3: Series logic (AND)
      // Button A AND Button B -> Memory Bit (SET)
      {
        id: "rung_3",
        cells: [
          [
            { type: "contact_no", variableId: "input_1" },
            { type: "contact_no", variableId: "input_2" },
            { type: "coil_set", variableId: "memory_1" },
            { type: "empty" },
            { type: "empty" },
            { type: "empty" },
            { type: "empty" },
            { type: "empty" },
            { type: "empty" },
            { type: "empty" },
          ],
        ],
      },

      // Rung 4: Parallel logic (OR) with memory
      // Memory Bit -> LED 3
      {
        id: "rung_4",
        cells: [
          [
            { type: "contact_no", variableId: "memory_1" },
            { type: "wire_h" },
            { type: "coil", variableId: "output_3" },
            { type: "empty" },
            { type: "empty" },
            { type: "empty" },
            { type: "empty" },
            { type: "empty" },
            { type: "empty" },
            { type: "empty" },
          ],
        ],
      },

      // Rung 5: Reset memory
      // Button B resets memory
      {
        id: "rung_5",
        cells: [
          [
            { type: "contact_no", variableId: "input_2" },
            { type: "wire_h" },
            { type: "coil_reset", variableId: "memory_1" },
            { type: "empty" },
            { type: "empty" },
            { type: "empty" },
            { type: "empty" },
            { type: "empty" },
            { type: "empty" },
            { type: "empty" },
          ],
        ],
      },
    ],
    timers: [],
  };
}

function App() {
  const [project, setProject] = useState<Project>(createDefaultProject());
  const [executionState, setExecutionState] = useState<ExecutionState>(
    initializeExecutionState(createDefaultProject())
  );
  const [isRunning, setIsRunning] = useState(true);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastScanRef = useRef(Date.now());

  // Main scan cycle loop
  useEffect(() => {
    if (!isRunning) return;

    scanIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const deltaMs = now - lastScanRef.current;
      lastScanRef.current = now;

      setExecutionState((prevState) => {
        const newState = simulateScan(project, prevState, deltaMs);
        return newState;
      });
    }, project.scanCycleMs);

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, [isRunning, project]);

  // Handle project changes
  const handleProjectChange = (newProject: Project) => {
    setProject(newProject);
    // Reset execution state with new project
    setExecutionState(initializeExecutionState(newProject));
  };

  // Handle input changes
  const handleInputChange = (variableId: string, value: boolean) => {
    setExecutionState((prevState) => {
      const newVariables = prevState.variables.map((v) =>
        v.id === variableId ? { ...v, value } : v
      );
      return { ...prevState, variables: newVariables };
    });
  };

  // Handle adding new variable
  const handleAddVariable = (type: "input" | "output" | "memory") => {
    const newVariable = createVariable(
      `var_${Date.now()}`,
      `${type.charAt(0).toUpperCase() + type.slice(1)} ${project.variables.length + 1}`,
      type
    );
    setProject({
      ...project,
      variables: [...project.variables, newVariable],
    });
  };

  // Handle deleting variable
  const handleDeleteVariable = (variableId: string) => {
    setProject({
      ...project,
      variables: project.variables.filter((v) => v.id !== variableId),
    });
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>Ladder Logic PLC Simulator</h1>
          <div className="header-controls">
            <button
              className={`btn-control ${isRunning ? "running" : "stopped"}`}
              onClick={() => setIsRunning(!isRunning)}
            >
              {isRunning ? "⏸ Pause" : "▶ Run"}
            </button>
            <span className={`status ${isRunning ? "running" : "stopped"}`}>
              {isRunning ? "Running" : "Paused"}
            </span>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="main-content">
          <LadderGrid project={project} onProjectChange={handleProjectChange} />
          <IOPanel
            project={project}
            executionState={executionState}
            onInputChange={handleInputChange}
            onAddVariable={handleAddVariable}
            onDeleteVariable={handleDeleteVariable}
          />
        </div>
      </main>

      <TooltipProvider>
        <Toaster />
      </TooltipProvider>
    </div>
  );
}

export default App;
