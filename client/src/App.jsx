import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const SERVER_URL = "http://localhost:5000";
const API_URL = `${SERVER_URL}/api/tasks`;

const STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Running", value: "running" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
];

function getTaskId(task) {
  return String(task.id ?? task._id ?? "");
}

function upsertTask(tasks, updatedTask) {
  const updatedId = getTaskId(updatedTask);

  if (!updatedId) return tasks;

  const exists = tasks.some(
    (task) => getTaskId(task) === updatedId
  );

  if (!exists) {
    return [updatedTask, ...tasks];
  }

  return tasks.map((task) =>
    getTaskId(task) === updatedId ? updatedTask : task
  );
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();

  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `Backend se valid JSON nahi mila (HTTP ${response.status}).`
      );
    }
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Request failed (HTTP ${response.status})`
    );
  }

  return data;
}

function App() {
  const [command, setCommand] = useState("");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [runningId, setRunningId] = useState(null);
  const [error, setError] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [logs, setLogs] = useState({});
  const socketRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    const socket = io(SERVER_URL, { autoConnect: false });

    let active = true;
    let requestVersion = 0;
    let taskRevision = 0;
    const pendingUpdates = new Map();

    async function loadTasks() {
      const version = ++requestVersion;
      const startingRevision = taskRevision;

      try {
        const data = await requestJson(API_URL, {
          signal: controller.signal,
        });

        if (!Array.isArray(data)) {
          throw new Error(
            "Tasks response array format me nahi hai."
          );
        }

        if (!active || version !== requestVersion) return;

        let mergedTasks = data;

        for (const { task, revision } of pendingUpdates.values()) {
          if (revision > startingRevision) {
            mergedTasks = upsertTask(mergedTasks, task);
          }
        }

        setTasks(mergedTasks);
      } catch (err) {
        if (
          active &&
          version === requestVersion &&
          err.name !== "AbortError"
        ) {
          setError(`Tasks load nahi hue: ${err.message}`);
        }
      } finally {
        if (active && version === requestVersion) {
          setLoading(false);
        }
      }
    }

    function handleConnect() {
      if (!active) return;

      setSocketConnected(true);
      void loadTasks();
    }

    function handleDisconnect() {
      if (active) {
        setSocketConnected(false);
      }
    }

    function handleConnectError() {
      if (active) {
        setSocketConnected(false);
      }
    }

    function handleTaskUpdate(updatedTask) {
      if (!active || !updatedTask || !getTaskId(updatedTask)) {
        return;
      }

      taskRevision += 1;

      pendingUpdates.set(getTaskId(updatedTask), {
        task: updatedTask,
        revision: taskRevision,
      });

      setTasks((previous) => upsertTask(previous, updatedTask));
    }

    function handleTaskLog(log) {
      if (!active || !log?.taskId) return;

      setLogs((previous) => ({
        ...previous,
        [log.taskId]: [
          ...(previous[log.taskId] || []),
          {
            id: `${log.taskId}-${log.at}-${Math.random()}`,
            message: log.message,
            level: log.level || "info",
            at: log.at,
          },
        ],
      }));
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("task:updated", handleTaskUpdate);
    socket.on("task:log", handleTaskLog);

    void loadTasks();
    socket.connect();

    socketRef.current = socket;

    return () => {
      active = false;
      controller.abort();

      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("task:updated", handleTaskUpdate);
      socket.off("task:log", handleTaskLog);

      socket.disconnect();
    };
  }, []);

  const agentRunning =
    runningId !== null ||
    tasks.some((task) => task.status === "running");

  const visibleTasks = tasks.filter((task) => {
    const matchesStatus =
      statusFilter === "all" || task.status === statusFilter;

    const matchesSearch = task.command
      ?.toLowerCase()
      .includes(searchQuery.trim().toLowerCase());

    return matchesStatus && matchesSearch;
  });

  async function addTask(event) {
    event.preventDefault();

    const topic = command.trim();

    if (!topic || loading || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const task = await requestJson(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ command: topic }),
      });

      if (!task || !getTaskId(task)) {
        throw new Error(
          "Backend response me task ID nahi mili."
        );
      }

      setTasks((previous) => upsertTask(previous, task));
      setCommand("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function runTask(taskId) {
    if (!taskId || agentRunning) return;

    setRunningId(taskId);
    setError("");

    socketRef.current?.emit("task:subscribe", taskId);

    try {
      const updatedTask = await requestJson(
        `${API_URL}/${encodeURIComponent(taskId)}/run`,
        { method: "POST" }
      );

      if (!updatedTask || !getTaskId(updatedTask)) {
        throw new Error(
          "Backend response me updated task nahi mila."
        );
      }

      setTasks((previous) => upsertTask(previous, updatedTask));
    } catch (err) {
      setError(err.message);

      try {
        const latestTasks = await requestJson(API_URL);

        if (!Array.isArray(latestTasks)) {
          throw new Error("Invalid tasks response");
        }

        setTasks(latestTasks);
      } catch {
        setError(
          `${err.message}. Task status refresh bhi fail hua.`
        );
      }
    } finally {
      setRunningId(null);
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">WebPilot</h1>

            <p className="mt-2 text-gray-400">
              AI-powered browser automation dashboard.
            </p>
          </div>

          <span
            role="status"
            className={`self-start rounded-full border px-3 py-1 text-xs ${
              socketConnected
                ? "border-emerald-800 bg-emerald-950 text-emerald-300"
                : "border-amber-800 bg-amber-950 text-amber-300"
            }`}
          >
            {socketConnected
              ? "Live connected"
              : "Live disconnected / connecting"}
          </span>
        </header>

        <form
          onSubmit={addTask}
          className="mt-8 flex flex-col gap-3 sm:flex-row"
        >
          <input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            disabled={submitting}
            placeholder="Tell me about India"
            aria-label="Automation command"
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

        <section className="mt-8 rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    statusFilter === filter.value
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <input
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(event.target.value)
              }
              placeholder="Search tasks"
              aria-label="Search tasks"
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm outline-none focus:border-blue-500 sm:w-64"
            />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-4 text-xl font-semibold">
            Tasks ({visibleTasks.length})
          </h2>

          {loading ? (
            <p className="text-gray-400">Loading tasks...</p>
          ) : visibleTasks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-700 p-8 text-center text-gray-400">
              No tasks match this filter.
            </p>
          ) : (
            <ul className="space-y-4">
              {visibleTasks.map((task) => {
                const taskId = getTaskId(task);

                const isRunning =
                  runningId === taskId ||
                  task.status === "running";

                const safeResultUrl =
                  typeof task.result?.url === "string" &&
                  task.result.url.startsWith(
                    "https://en.wikipedia.org/"
                  )
                    ? task.result.url
                    : null;

                const safeScreenshotUrl =
                  typeof task.result?.screenshotUrl ===
                    "string" &&
                  task.result.screenshotUrl.startsWith(
                    "http://localhost:5000/"
                  )
                    ? task.result.screenshotUrl
                    : null;

                return (
                  <li
                    key={taskId}
                    className="rounded-xl border border-gray-800 bg-gray-900 p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="break-words font-semibold">
                          {task.command}
                        </h3>

                        <p className="mt-1 text-sm text-gray-400">
                          {task.createdAt
                            ? new Date(
                                task.createdAt
                              ).toLocaleString()
                            : ""}
                        </p>

                        <span
                          className={`mt-3 inline-block rounded-full px-3 py-1 text-xs ${
                            isRunning
                              ? "bg-blue-950 text-blue-300"
                              : task.status === "completed"
                              ? "bg-emerald-950 text-emerald-300"
                              : task.status === "failed"
                              ? "bg-red-950 text-red-300"
                              : "bg-gray-800 text-gray-300"
                          }`}
                        >
                          {isRunning
                            ? "running"
                            : task.status || "pending"}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => runTask(taskId)}
                        disabled={agentRunning || !taskId}
                        className="self-start rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isRunning ? "Running..." : "Run"}
                      </button>
                    </div>

                    {logs[taskId]?.length > 0 && (
                      <div className="mt-4 rounded-lg border border-gray-700 bg-black p-4">
                        <h4 className="mb-2 text-sm font-semibold text-gray-300">
                          Live logs
                        </h4>

                        <div className="max-h-48 overflow-y-auto font-mono text-xs">
                          {logs[taskId].map((log) => (
                            <p
                              key={log.id}
                              className={
                                log.level === "error"
                                  ? "text-red-400"
                                  : log.level === "success"
                                  ? "text-emerald-400"
                                  : "text-gray-300"
                              }
                            >
                              {log.message}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {task.error && (
                      <p className="mt-4 break-words text-sm text-red-400">
                        {task.error}
                      </p>
                    )}

                    {task.result && (
                      <div className="mt-5 rounded-lg border border-gray-700 bg-gray-950 p-4">
                        <h4 className="text-lg font-semibold">
                          {task.result.title || "Task result"}
                        </h4>

                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-300">
                          {task.result.summary ||
                            "No summary extracted."}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-4">
                          {safeResultUrl && (
                            <a
                              href={safeResultUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-400 underline"
                            >
                              Open Wikipedia page
                            </a>
                          )}

                          {safeScreenshotUrl && (
                            <a
                              href={safeScreenshotUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-400 underline"
                            >
                              View screenshot
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

export default App;