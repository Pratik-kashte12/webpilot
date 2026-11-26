const COMMAND_PREFIXES = [
  /^tell me about\s+/i,
  /^what is\s+/i,
  /^what are\s+/i,
  /^search\s+(?:for\s+)?/i,
  /^find\s+(?:information about\s+)?/i,
  /^open\s+wikipedia(?:\s+page)?\s+(?:for|about|on)\s+/i,
  /^open\s+/i,
  /^wikipedia\s+(?:page\s+)?(?:for|about|on)\s+/i,
  /^information about\s+/i,
  /^details about\s+/i,
];

const KNOWN_TOPICS = [
  {
    pattern: /\bpython\b/i,
    topic: "Python (programming language)",
  },
  {
    pattern: /\bjavascript\b/i,
    topic: "JavaScript",
  },
  {
    pattern: /\breact\b/i,
    topic: "React (software)",
  },
  {
    pattern: /\bnode\.?js\b/i,
    topic: "Node.js",
  },
  {
    pattern: /\bmongodb\b/i,
    topic: "MongoDB",
  },
  {
    pattern: /\bexpress\.?js\b/i,
    topic: "Express.js",
  },
  {
    pattern: /\bsocket\.?io\b/i,
    topic: "Socket.IO",
  },
];

export function extractTopicLocally(command) {
  const cleanedCommand = String(command || "").trim();

  if (!cleanedCommand) {
    return "";
  }

  for (const knownTopic of KNOWN_TOPICS) {
    if (knownTopic.pattern.test(cleanedCommand)) {
      return knownTopic.topic;
    }
  }

  let topic = cleanedCommand;

  for (const prefix of COMMAND_PREFIXES) {
    topic = topic.replace(prefix, "");
  }

  topic = topic
    .replace(/[?.!]+$/g, "")
    .replace(/^["']|["']$/g, "")
    .trim();

  return topic;
}