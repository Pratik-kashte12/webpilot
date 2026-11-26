import OpenAI from "openai";
import { extractTopicLocally } from "./topicParser.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const TOPIC_SCHEMA = {
  type: "object",
  properties: {
    topic: {
      type: "string",
      description:
        "Exact Wikipedia article topic. Use an empty string if no clear topic exists.",
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
    },
  },
  required: ["topic", "confidence"],
  additionalProperties: false,
};

export async function extractWikipediaTopic(command) {
  const localTopic = extractTopicLocally(command);

  if (localTopic) {
    return localTopic;
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is missing in server/.env"
    );
  }

  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "wikipedia_topic",
        strict: true,
        schema: TOPIC_SCHEMA,
      },
    },
    messages: [
      {
        role: "system",
        content: [
          "You convert a user command into the best exact Wikipedia article topic.",
          "Return a topic only when you are confident about a single Wikipedia article.",
          "Use an empty topic string when the request is unclear.",
        ].join(" "),
      },
      {
        role: "user",
        content: command,
      },
    ],
  });

  const rawContent = completion.choices?.[0]?.message?.content;

  if (!rawContent) {
    throw new Error("AI did not return a response.");
  }

  let parsed;

  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error("AI returned invalid JSON.");
  }

  const topic = String(parsed.topic || "").trim();

  if (!topic) {
    throw new Error(
      "Could not identify a Wikipedia topic from this command."
    );
  }

  return topic;
}