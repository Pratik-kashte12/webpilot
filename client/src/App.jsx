import { useEffect, useState } from "react";

const API_URL = "http://localhost:5000/api/tasks";

function App() {
  const [command, setCommand] = useState("");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadTasks() {
      try {
        const response = await fetch(API_URL, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Could not load tasks.");
        }

        const data = await response.json();
        setTasks(data);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError("Tasks load nahi hue. Backend running hai kya?");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadTasks();

    return () => controller.abort();
  }, []);

  async function addTask(event) {
    event.preventDefault();

    const trimmedCommand = command.trim();

    if (!trimmedCommand || loading || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          command: trimmedCommand,
        }),
      });

      if (!response.ok) {
        throw new Error("Could not create task.");
      }

      const newTask = await response.json();

      setTasks((previousTasks) => [newTask, ...previousTasks]);
      setCommand("");
    } catch {
      setError("Task add nahi hua. Backend aur connection check karo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold">WebPilot</h1>

        <p className="mt-2 text-gray-400">
          Browser automation task dashboard
        </p>

        <form
          onSubmit={addTask}
          className="mt-8 flex flex-col gap-3 sm:flex-row"
        >
          <input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            disabled={submitting}
            placeholder="Example: Open Wikipedia and search India"
            aria-label="Browser task command"
            className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 outline-none focus:border-blue-500"
          />

          <button
            type="submit"
            disabled={!command.trim() || loading || submitting}
            className="rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Adding..." : "Add Task"}
          </button>
        </form>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-900 bg-red-950 p-3 text-red-300"
          >
            {error}
          </p>
        )}

        <p className="mt-4 text-sm text-amber-400">
          Tasks backend memory me hain. Server restart par reset honge.
          Browser execution abhi connected nahi hai.
        </p>

        <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold">
            Tasks ({tasks.length})
          </h2>

          {loading ? (
            <p className="text-gray-400">Loading tasks...</p>
          ) : tasks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-700 p-8 text-center text-gray-400">
              No tasks to display.
            </p>
          ) : (
            <ul className="space-y-3">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className="rounded-xl border border-gray-800 bg-gray-900 p-5"
                >
                  <p className="break-words font-medium">
                    {task.command}
                  </p>

                  <p className="mt-2 text-sm text-gray-400">
                    {new Date(task.createdAt).toLocaleString()}
                  </p>

                  <span className="mt-3 inline-block rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-300">
                    {task.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

export default App;