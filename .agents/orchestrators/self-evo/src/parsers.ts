// Helpers for parsing JSON out of model responses. Models routinely
// wrap JSON in ```json fences or add chatter around it. These helpers
// strip the most common shapes and surface a clear error so callers
// can choose to fall back, retry, or surface a stage-level failure.

export class JsonParseError extends Error {
  constructor(message: string, public readonly raw: string) {
    super(`${message}\n--- raw output (first 400 chars) ---\n${raw.slice(0, 400)}`);
    this.name = "JsonParseError";
  }
}

const FENCE_RE = /```(?:json)?\s*\n([\s\S]*?)\n```/i;

export function stripCodeFence(text: string): string {
  const m = FENCE_RE.exec(text);
  if (m) return m[1]!.trim();
  return text.trim();
}

// Find the first balanced { ... } or [ ... ] in text. Lets us tolerate
// short prefixes/suffixes ("Here is the JSON:\n{ ... }").
function extractFirstJson(text: string): string | undefined {
  const startObj = text.indexOf("{");
  const startArr = text.indexOf("[");
  const start =
    startObj === -1 ? startArr : startArr === -1 ? startObj : Math.min(startObj, startArr);
  if (start === -1) return undefined;
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return undefined;
}

export function parseJsonResponse<T>(text: string): T {
  const fenced = stripCodeFence(text);
  for (const candidate of [fenced, extractFirstJson(fenced) ?? fenced]) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // try the next candidate
    }
  }
  throw new JsonParseError("could not parse JSON from model response", text);
}
