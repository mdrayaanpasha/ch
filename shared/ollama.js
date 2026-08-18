// Thin Ollama client shared by every service. Uses the local /api/chat endpoint
// with format:"json" so the model is forced to emit parseable JSON.
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5-coder-16k:latest";

/**
 * Free-form chat completion. Returns the assistant message content string.
 * @param {{system?: string, prompt: string, model?: string, temperature?: number}} opts
 */
export async function chat({ system, prompt, model, temperature = 0.2 }) {
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: model || OLLAMA_MODEL,
      messages,
      stream: false,
      options: { temperature },
    }),
  });
  if (!res.ok) {
    throw new Error(`Ollama ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const data = await res.json();
  return data?.message?.content ?? "";
}

/**
 * Chat completion constrained to JSON. Returns the parsed object.
 * Falls back to extracting the first {...} block if the model wraps it in prose.
 */
export async function chatJSON({ system, prompt, model, temperature = 0.2 }) {
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: model || OLLAMA_MODEL,
      messages,
      stream: false,
      format: "json",
      options: { temperature },
    }),
  });
  if (!res.ok) {
    throw new Error(`Ollama ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const data = await res.json();
  const content = data?.message?.content ?? "";
  return parseLooseJSON(content);
}

export function parseLooseJSON(text) {
  if (typeof text !== "string") return text;
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch { /* fall through */ }
    }
    throw new Error(`Model did not return valid JSON: ${text.slice(0, 200)}`);
  }
}

export const config = { OLLAMA_HOST, OLLAMA_MODEL };
