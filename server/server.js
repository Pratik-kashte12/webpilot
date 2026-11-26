import "dotenv/config";

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { Server } from "socket.io";

import Task from "./models/Task.js";
import { extractWikipediaTopic } from "./ai.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

const automationDirectory = path.join(__dirname, "..", "automation");
const agentScript = path.join(automationDirectory, "agent.py");
const pythonExecutable = path.join(
  __dirname,
  "..",
  ".venv",
  "Scripts",
  "python.exe"
);

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ],
  },
});

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ],
  })
);

app.use(express.json());

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("task:subscribe", (taskId) => {
    if (typeof taskId !== "string" || !taskId.trim()) {
      return;
    }

    socket.join(`task:${taskId.trim()}`);
    console.log(
      `Socket ${socket.id} subscribed to task ${taskId}`
    );
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

app.get("/", (req, res) => {
  res.json({
    message: "WebPilot backend is running",
  });
});

app.get("/api/tasks", async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    console.error("GET /api/tasks error:", error);

    res.status(500).json({
      message: "Could not load tasks.",
    });
  }
});

app.post("/api/tasks", async (req, res) => {
  try {
    const command = String(req.body?.command || "").trim();

    if (!command) {
      return res.status(400).json({
        message: "Task command is required.",
      });
    }

    let wikipediaTopic = command;

    try {
      wikipediaTopic = await extractWikipediaTopic(command);
    } catch (aiError) {
      console.warn(
        "AI topic extraction unavailable; using original command:",
        aiError.message
      );
    }

    const task = await Task.create({
      command: wikipediaTopic,
      status: "pending",
    });

    io.emit("task:updated", task.toObject());

    res.status(201).json(task);
  } catch (error) {
    console.error("POST /api/tasks error:", error);

    res.status(500).json({
      message: "Could not create task.",
    });
  }
});

app.get("/api/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid task ID.",
      });
    }

    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({
        message: "Task not found.",
      });
    }

    res.json(task);
  } catch (error) {
    console.error("GET /api/tasks/:id error:", error);

    res.status(500).json({
      message: "Could not load task.",
    });
  }
});

app.post("/api/tasks/:id/run", async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      message: "Invalid task ID.",
    });
  }

  let task;

  try {
    task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({
        message: "Task not found.",
      });
    }

    if (task.status === "running") {
      return res.status(409).json({
        message: "Task is already running.",
      });
    }

    task.status = "running";
    task.result = null;
    task.error = "";
    await task.save();

    io.emit("task:updated", task.toObject());

    const taskRoom = `task:${id}`;

    io.to(taskRoom).emit("task:log", {
      taskId: id,
      message: "Task started.",
      level: "info",
      at: new Date().toISOString(),
    });

    const result = await runPythonAgent(id, task.command);

    task.status = "completed";
    task.result = result;
    await task.save();

    io.emit("task:updated", task.toObject());

    io.to(taskRoom).emit("task:log", {
      taskId: id,
      message: "Task completed successfully.",
      level: "success",
      at: new Date().toISOString(),
    });

    res.json(task);
  } catch (error) {
    console.error("POST /api/tasks/:id/run error:", error);

    const failureMessage =
      error?.message || "Task execution failed.";

    if (task) {
      task.status = "failed";
      task.error = failureMessage;

      try {
        await task.save();

        io.emit("task:updated", task.toObject());

        io.to(`task:${id}`).emit("task:log", {
          taskId: id,
          message: failureMessage,
          level: "error",
          at: new Date().toISOString(),
        });
      } catch (saveError) {
        console.error(
          "Could not save failed task:",
          saveError
        );
      }
    }

    res.status(500).json({
      message: failureMessage,
    });
  }
});

function runPythonAgent(taskId, command) {
  return new Promise((resolve, reject) => {
    let stdoutData = "";
    let stderrData = "";
    let settled = false;

    const pythonProcess = spawn(
      pythonExecutable,
      [agentScript, command],
      {
        cwd: automationDirectory,
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
      }
    );

    const taskRoom = `task:${taskId}`;

    const emitLog = (message, level = "info") => {
      if (!message) return;

      io.to(taskRoom).emit("task:log", {
        taskId,
        message: String(message),
        level,
        at: new Date().toISOString(),
      });
    };

    pythonProcess.stdout.on("data", (data) => {
      stdoutData += data.toString();

      const lines = stdoutData.split("\n");
      stdoutData = lines.pop() || "";

      for (const line of lines) {
        const trimmedLine = line.trim();

        if (!trimmedLine) continue;

        try {
          const message = JSON.parse(trimmedLine);

          if (message.type === "log") {
            emitLog(message.message);
          } else if (message.type === "result") {
            resolve(message.result);
            settled = true;
          } else if (message.type === "error") {
            reject(
              new Error(
                message.message ||
                  "Python agent reported an error."
              )
            );

            settled = true;
          }
        } catch {
          console.log(`Python output: ${trimmedLine}`);
          emitLog(trimmedLine);
        }
      }
    });

    pythonProcess.stderr.on("data", (data) => {
      const chunk = data.toString();

      stderrData += chunk;

      console.error(chunk);

      emitLog(chunk.trim(), "error");
    });

    pythonProcess.on("error", (error) => {
      if (settled) return;

      settled = true;

      reject(
        new Error(
          `Could not start Python agent: ${error.message}`
        )
      );
    });

    pythonProcess.on("close", (code) => {
      if (settled) return;

      settled = true;

      if (code === 0) {
        reject(
          new Error(
            "Python agent exited without returning a result."
          )
        );

        return;
      }

      const errorMessage =
        stderrData.trim() ||
        `Python agent exited with code ${code}.`;

      reject(new Error(errorMessage));
    });
  });
}

async function connectToDatabase() {
  if (!MONGO_URI) {
    throw new Error(
      "MONGO_URI is missing. Add it to server/.env without sharing it publicly."
    );
  }

  await mongoose.connect(MONGO_URI);

  console.log("MongoDB connected");
}

async function startServer() {
  try {
    await connectToDatabase();

    httpServer.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log("Socket.IO enabled");
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();