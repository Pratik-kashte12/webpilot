import { useState } from "react";

function App() {
  const [command, setCommand] = useState("");

  const runTask = () => {
    if (!command.trim()) return;
    console.log("Task:", command);
    setCommand("");
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <h1 className="text-3xl font-bold mb-6">WebPilot</h1>

      <div className="flex gap-3">
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Enter a browser task..."
          className="flex-1 px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 outline-none"
        />

        <button
          onClick={runTask}
          className="px-6 py-3 bg-blue-600 rounded-lg font-semibold"
        >
          Run Task
        </button>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Tasks</h2>
        <p className="text-gray-400">No tasks yet.</p>
      </div>
    </div>
  );
}

export default App;