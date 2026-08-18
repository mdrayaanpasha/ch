// Debate + judge stage. Takes the collected per-bias findings and runs a
// 3-round exchange (advocates → skeptic → rebuttal) then a judge synthesizes a
// final scored verdict. All reasoning via Ollama.
import { chat, chatJSON } from "../../shared/ollama.js";

const summarize = (f) =>
  `${f.bias.toUpperCase()} (detected=${f.detected}, severity=${f.severity}): ` +
  `${f.explanation}` +
  (f.evidence?.length ? ` Evidence: ${f.evidence.map((e) => `"${e}"`).join("; ")}` : "");

export async function runDebate(text, findings) {
  const available = findings.filter((f) => f && !f.unavailable);
  const transcript = [];

  // R1 — Advocates: each detector's case, stated for the record.
  const advocacy = available.map((f) => ({
    bias: f.bias,
    statement: summarize(f),
  }));
  transcript.push({ round: "advocates", entries: advocacy });

  // R2 — Skeptic rebuts every claim at once (sees all advocates together).
  const skeptic = await chat({
    system:
      "You are a rigorous skeptic in a bias-detection debate. For each advocate " +
      "claim, challenge it: is the evidence real and on-topic, is the severity " +
      "inflated, could a neutral reader disagree? Be concise and specific per bias.",
    prompt:
      `ORIGINAL TEXT:\n"""${text}"""\n\nADVOCATE CLAIMS:\n` +
      advocacy.map((a) => `- ${a.statement}`).join("\n") +
      `\n\nGive one short rebuttal paragraph per bias, prefixed with the bias name.`,
  });
  transcript.push({ round: "skeptic", content: skeptic });

  // R3 — Advocates respond to the skeptic.
  const rebuttal = await chat({
    system:
      "You represent the bias detectors. Respond to the skeptic's rebuttals, " +
      "conceding weak points and defending well-supported ones. Concise, per bias.",
    prompt:
      `ORIGINAL TEXT:\n"""${text}"""\n\nORIGINAL CLAIMS:\n` +
      advocacy.map((a) => `- ${a.statement}`).join("\n") +
      `\n\nSKEPTIC:\n${skeptic}\n\nRespond per bias.`,
  });
  transcript.push({ round: "rebuttal", content: rebuttal });

  // Judge — final synthesized verdict.
  const verdict = await chatJSON({
    system:
      "You are the presiding judge of a bias-detection debate. Weigh the advocates, " +
      "the skeptic, and the rebuttal. Assign a fair final severity (0-10) per bias " +
      "and an overall verdict. Respond only in JSON.",
    prompt:
      `ORIGINAL TEXT:\n"""${text}"""\n\nADVOCATES:\n` +
      advocacy.map((a) => `- ${a.statement}`).join("\n") +
      `\n\nSKEPTIC:\n${skeptic}\n\nREBUTTAL:\n${rebuttal}\n\n` +
      `Respond as JSON:\n{\n` +
      `  "perBias": [ {"bias": string, "finalSeverity": integer 0-10, "note": string}, ... ],\n` +
      `  "overallVerdict": "biased" | "mostly-neutral" | "neutral",\n` +
      `  "rationale": "one paragraph"\n}`,
  });

  return {
    transcript,
    verdict: {
      perBias: Array.isArray(verdict.perBias) ? verdict.perBias : [],
      overallVerdict: verdict.overallVerdict || "unknown",
      rationale: String(verdict.rationale ?? ""),
    },
  };
}
