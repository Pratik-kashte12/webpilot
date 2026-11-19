import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const tasks = [];

app.get("/", (req, res) => {
  res.send("WebPilot server is running");
});

// All tasks return karo
app.get("/api/tasks", (req, res) => {
  res.json(tasks);
});

// Naya task create karo
app.post("/api/tasks", (req, res) => {
  const command = req.body?.command;

  if (typeof command !== "string" || !command.trim()) {
    return res.status(400).json({
      message: "Please enter a valid command",
    });
  }

  const task = {
    id: randomUUID(),
    command: command.trim(),
    status: "Not executed",
    createdAt: new Date().toISOString(),
  };

  tasks.unshift(task);

  console.log("Task received:", task.command);

  res.status(201).json(task);
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});