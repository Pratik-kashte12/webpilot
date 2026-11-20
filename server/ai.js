import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export async function extractWikipediaTopic(command) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is missing in server/.env"
    );
  }

  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: {
      type: "json_object",
    },
    messages: [
      {
        role: "system",
        content: [
          "You convert a user command into the best exact Wikipedia article topic.",
          "Return only valid JSON.",
          "Use this JSON shape: {\"topic\": \"string\", \"confidence\": \"high\" | \"medium\" | \"low\"}.",
          "If the command is unclear or cannot identify one topic, return {\"topic\": \"\", \"confidence\": \"low\"}.",
          "Do not add explanations.",
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