import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Task ka database structure
const taskSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: () => randomUUID(),
      unique: true,
    },
    command: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      default: "Not executed",
    },
  },
  {
    timestamps: true,
  }
);

const Task = mongoose.model("Task", taskSchema);

app.get("/", (req, res) => {
  res.send("WebPilot server is running");
});

// Database se tasks lao
app.get("/api/tasks", async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    console.error("Load tasks failed:", error.message);

    res.status(500).json({
      message: "Could not load tasks",
    });
  }
});

// Naya task database me save karo
app.post("/api/tasks", async (req, res) => {
  const command = req.body?.command;

  if (typeof command !== "string" || !command.trim()) {
    return res.status(400).json({
      message: "Please enter a valid command",
    });
  }

  try {
    const task = await Task.create({
      command: command.trim(),
    });

    console.log("Task saved:", task.command);

    res.status(201).json(task);
  } catch (error) {
    console.error("Save task failed:", error.message);

    res.status(500).json({
      message: "Could not save task",
    });
  }
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI missing. Check server/.env");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "webpilot",
      serverSelectionTimeoutMS: 10000,
    });

    console.log("MongoDB connected");

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

startServer();