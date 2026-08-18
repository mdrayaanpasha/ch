// Omission-bias microservice (:5001) — the retrieval-backed one.
// 1) extract topic + entities  2) pull keyless ground truth (Wikipedia + DuckDuckGo)
// 3) ask the model which material facts in the sources are ABSENT from the text.
import express from "express";
import cors from "cors";
import { chatJSON } from "../../../shared/ollama.js";
import { getJSON } from "../../../shared/http.js";
import { clampSeverity } from "../../../shared/focusedDetector.js";
import { cacheKey, withCache } from "../../../shared/cache.js";

const app = express();
const PORT = process.env.PORT || 5001;
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ status: "ok", service: "omission" }));

// --- step 1: topic + entities ------------------------------------------------
async function extractEntities(text) {
  const out = await chatJSON({
    system:
      "You extract the main topic and named entities from text for a fact lookup. Respond only in JSON.",
    prompt:
      `From the TEXT, give the single main topic and up to 4 specific entities ` +
      `(people, places, organizations, events) worth looking up.\n\nTEXT:\n"""${text}"""\n\n` +
      `Respond as JSON: {"topic": string, "entities": [string, ...]}`,
  });
  const entities = Array.isArray(out.entities) ? out.entities.slice(0, 4) : [];
  const topic = String(out.topic || "").trim();
  return { topic, entities };
}

// --- step 2: keyless retrieval ----------------------------------------------
async function wikipediaSummary(title) {
  const url =
    "https://en.wikipedia.org/api/rest_v1/page/summary/" +
    encodeURIComponent(title.replace(/\s+/g, "_"));
  const data = await getJSON(url, { headers: { "user-agent": "BiasDetector/1.0" } });
  if (!data || !data.extract) return null;
  return { source: `Wikipedia: ${data.title}`, fact: data.extract };
}

async function duckduckgo(query) {
  const url =
    "https://api.duckduckgo.com/?format=json&no_html=1&skip_disambig=1&q=" +
    encodeURIComponent(query);
  const data = await getJSON(url);
  if (!data) return [];
  const facts = [];
  if (data.AbstractText) facts.push({ source: `DuckDuckGo: ${data.Heading || query}`, fact: data.AbstractText });
  for (const t of data.RelatedTopics || []) {
    if (t.Text) facts.push({ source: "DuckDuckGo related", fact: t.Text });
    if (facts.length >= 5) break;
  }
  return facts;
}

async function gatherReferenceFacts({ topic, entities }) {
  const lookups = [];
  if (topic) lookups.push(wikipediaSummary(topic), duckduckgo(topic));
  for (const e of entities) lookups.push(wikipediaSummary(e));
  const results = await Promise.all(lookups);
  const facts = [];
  for (const r of results) {
    if (!r) continue;
    if (Array.isArray(r)) facts.push(...r);
    else facts.push(r);
  }
  // de-dupe by fact text
  const seen = new Set();
  return facts.filter((f) => f && f.fact && !seen.has(f.fact) && seen.add(f.fact)).slice(0, 12);
}

// --- step 3: compare & find omissions ---------------------------------------
async function findOmissions(text, facts) {
  const refBlock = facts.map((f, i) => `[${i + 1}] (${f.source}) ${f.fact}`).join("\n");
  const out = await chatJSON({
    system:
      "You are an omission-bias detector. Compare a TEXT against REFERENCE FACTS " +
      "retrieved from encyclopedic sources. Report material facts that appear in the " +
      "references but are ABSENT from the text and that would change a reader's " +
      "understanding if included. Do NOT invent facts beyond the references. If the " +
      "text already covers the references, report no omissions. Respond only in JSON.",
    prompt:
      `TEXT:\n"""${text}"""\n\nREFERENCE FACTS:\n${refBlock}\n\n` +
      `Respond as JSON:\n{\n` +
      `  "detected": boolean,\n` +
      `  "severity": integer 0-10,\n` +
      `  "evidence": [ "material fact present in references but missing from the text", ... ],\n` +
      `  "explanation": "one paragraph on what is omitted and why it matters"\n}`,
  });
  return out;
}

app.post("/analyze", async (req, res) => {
  const text = req.body?.text;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "body.text (string) is required" });
  }
  try {
    const { value, cached } = await withCache(cacheKey("omission", text), async () => {
      const { topic, entities } = await extractEntities(text);
      const facts = await gatherReferenceFacts({ topic, entities });

      if (facts.length === 0) {
        // Guard: no ground truth retrieved → do not hallucinate omissions.
        return {
          bias: "omission",
          detected: false,
          severity: 0,
          evidence: [],
          explanation:
            "No reference facts could be retrieved for this topic, so omission bias could not be assessed.",
          retrieval: { topic, entities, factsFound: 0 },
        };
      }

      const out = await findOmissions(text, facts);
      return {
        bias: "omission",
        detected: Boolean(out.detected),
        severity: clampSeverity(out.severity),
        evidence: Array.isArray(out.evidence) ? out.evidence.slice(0, 8) : [],
        explanation: String(out.explanation ?? ""),
        retrieval: { topic, entities, factsFound: facts.length, sources: facts.map((f) => f.source) },
      };
    });
    res.json({ ...value, cached });
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
});

app.listen(PORT, () => console.log(`[omission] listening on http://localhost:${PORT}`));
