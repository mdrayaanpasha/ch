// Reusable "focused prompt vs generic baseline" detector for the framing and
// fear services. Runs two Ollama calls on the same text and returns both so the
// caller can prove the focused single-purpose prompt beats the generic one.
import { chatJSON } from "./ollama.js";
import { cacheKey, withCache } from "./cache.js";

const GENERIC_SYSTEM =
  "You check text for bias. Respond in JSON.";

const GENERIC_PROMPT = (text) =>
  `Check this text for bias.\n\nTEXT:\n"""${text}"""\n\n` +
  `Respond as JSON: {"detected": boolean, "explanation": string}`;

/**
 * @param {object} o
 * @param {"framing"|"fear"} o.bias
 * @param {string} o.focusedSystem  tightly-scoped system prompt (the product)
 * @param {(text:string)=>string} o.focusedPrompt  builds the focused user prompt
 * @param {string} o.text
 */
export async function focusedVsGeneric({ bias, focusedSystem, focusedPrompt, text }) {
  const key = cacheKey(bias, text);
  const { value, cached } = await withCache(key, async () => {
    const [focused, baseline] = await Promise.all([
      chatJSON({ system: focusedSystem, prompt: focusedPrompt(text) }),
      chatJSON({ system: GENERIC_SYSTEM, prompt: GENERIC_PROMPT(text) }),
    ]);

    return {
      bias,
      detected: Boolean(focused.detected),
      severity: clampSeverity(focused.severity),
      evidence: Array.isArray(focused.evidence) ? focused.evidence.slice(0, 8) : [],
      explanation: String(focused.explanation ?? ""),
      baseline: {
        detected: Boolean(baseline.detected),
        explanation: String(baseline.explanation ?? ""),
      },
    };
  });
  return { ...value, cached };
}

export function clampSeverity(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10, Math.round(n)));
}
