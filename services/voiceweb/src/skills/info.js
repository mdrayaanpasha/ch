// Info skill — answer a factual question using keyless encyclopedic sources
// (Wikipedia REST + DuckDuckGo Instant Answer), then have the LLM phrase a short
// spoken answer grounded in what was retrieved. Retrieval pattern mirrors
// services/omission/src/index.js.
import { chat } from "../../../../shared/ollama.js";
import { getJSON } from "../../../../shared/http.js";

async function wikipediaSummary(title) {
  const url =
    "https://en.wikipedia.org/api/rest_v1/page/summary/" +
    encodeURIComponent(title.replace(/\s+/g, "_"));
  const data = await getJSON(url, { headers: { "user-agent": "VoiceWeb/1.0" } });
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
  if (data.AbstractText)
    facts.push({ source: `DuckDuckGo: ${data.Heading || query}`, fact: data.AbstractText });
  for (const t of data.RelatedTopics || []) {
    if (t.Text) facts.push({ source: "DuckDuckGo related", fact: t.Text });
    if (facts.length >= 4) break;
  }
  return facts;
}

export async function info(query) {
  const [wiki, ddg] = await Promise.all([wikipediaSummary(query), duckduckgo(query)]);
  const facts = [wiki, ...ddg].filter(Boolean).slice(0, 6);

  if (facts.length === 0) {
    return {
      skill: "info",
      speak: `I couldn't find reliable information about "${query}". Try rephrasing, or ask me something else.`,
      actions: ["Ask a different question", "Search for jobs", "Make my resume"],
    };
  }

  const refBlock = facts.map((f, i) => `[${i + 1}] (${f.source}) ${f.fact}`).join("\n");
  const answer = await chat({
    system:
      "You are a spoken voice assistant for a blind user. Answer using ONLY the " +
      "provided reference facts. Be warm, clear, and brief — 2 to 3 short sentences " +
      "that read well aloud. No markdown, no lists, no citations.",
    prompt: `QUESTION: ${query}\n\nREFERENCE FACTS:\n${refBlock}\n\nSpoken answer:`,
  });

  return {
    skill: "info",
    speak: answer.trim(),
    actions: ["Ask a follow-up question", "Search for jobs", `Read more on a web page`],
    data: { sources: facts.map((f) => f.source) },
  };
}
