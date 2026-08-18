// Orchestrator core: normalize input → fan out to the 3 detector services →
// debate + judge. Kept separate from the Express wiring in index.js.
import { postJSON } from "../../shared/http.js";
import { isUrl, fetchArticleText } from "../../shared/extract.js";
import { cacheKey, withCache } from "../../shared/cache.js";
import { runDebate } from "./debate.js";

const SERVICES = [
  { bias: "omission", url: process.env.OMISSION_URL || "http://localhost:5001/analyze" },
  { bias: "framing", url: process.env.FRAMING_URL || "http://localhost:5002/analyze" },
  { bias: "fear", url: process.env.FEAR_URL || "http://localhost:5003/analyze" },
];

export async function analyze(input) {
  // Full-pipeline cache: identical input short-circuits every downstream call.
  const { value, cached } = await withCache(cacheKey("orchestrator", input), () =>
    runPipeline(input)
  );
  return { ...value, cached };
}

async function runPipeline(input) {
  // 1. Normalize prompt-or-URL into plain text.
  let normalized = { source: "prompt", text: input };
  if (isUrl(input)) {
    const { title, text } = await fetchArticleText(input);
    normalized = { source: "url", url: input, title, text };
  }
  const text = normalized.text;

  // 2. Fan out to detectors in parallel; tolerate a down service.
  const settled = await Promise.allSettled(
    SERVICES.map((s) => postJSON(s.url, { text }))
  );
  const findings = settled.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      bias: SERVICES[i].bias,
      unavailable: true,
      detected: false,
      severity: 0,
      evidence: [],
      explanation: `Service unavailable: ${String(r.reason?.message || r.reason)}`,
    };
  });

  // 3. Debate + judge.
  const { transcript, verdict } = await runDebate(text, findings);

  return {
    input,
    normalized: { ...normalized, text: undefined, textPreview: text.slice(0, 500) },
    findings,
    debate: { transcript },
    verdict,
  };
}
