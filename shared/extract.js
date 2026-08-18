// URL detection + article-text extraction (used by the orchestrator to normalize
// a web link into plain text before fan-out).
import * as cheerio from "cheerio";
import { getText } from "./http.js";

export function isUrl(input) {
  if (typeof input !== "string") return false;
  try {
    const u = new URL(input.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Fetch a URL and return readable article text (nav/script/style stripped).
 * Prefers <article>/<main> when present; falls back to <body>. Collapses
 * whitespace and caps length so we don't blow the model context.
 */
export async function fetchArticleText(url, { maxChars = 8000 } = {}) {
  const html = await getText(url, {
    timeoutMs: 20000,
    headers: { "user-agent": "Mozilla/5.0 (BiasDetector/1.0)" },
  });
  if (!html) throw new Error(`Could not fetch ${url}`);

  const $ = cheerio.load(html);
  $("script, style, noscript, nav, header, footer, aside, form").remove();

  const scope = $("article").first().length
    ? $("article").first()
    : $("main").first().length
    ? $("main").first()
    : $("body");

  const text = scope
    .text()
    .replace(/\s+/g, " ")
    .trim();

  const title = ($("title").first().text() || "").replace(/\s+/g, " ").trim();
  const body = text.slice(0, maxChars);
  return { title, text: title ? `${title}\n\n${body}` : body };
}
