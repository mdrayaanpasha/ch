// Browse skill — fetch a web page, summarize it aloud for a blind user, then
// offer the page's links: "Do you want me to go somewhere?" On a follow-up like
// "go to the about page" we match the spoken words to a link and read that page
// too. The current page + its links ride along in `context` so navigation is a
// conversation, not a fresh command each time.
import { chat } from "../../../../shared/ollama.js";
import { fetchArticleText } from "../../../../shared/extract.js";
import { getText } from "../../../../shared/http.js";
import * as cheerio from "cheerio";

const firstUrl = (s) => (String(s).match(/https?:\/\/\S+/i) || [null])[0];

// Pull a short list of meaningful, followable links (absolute URLs) from a page.
async function fetchLinks(url) {
  const html = await getText(url, {
    timeoutMs: 20000,
    headers: { "user-agent": "Mozilla/5.0 (VoiceWeb/1.0)" },
  });
  if (!html) return [];
  const $ = cheerio.load(html);
  const links = [];
  const seen = new Set();
  $("a[href]").each((_, el) => {
    let label = ($(el).text() || $(el).attr("aria-label") || "").replace(/\s+/g, " ").trim();
    const raw = $(el).attr("href") || "";
    if (!label || label.length < 2 || label.length > 40) return;
    if (/^(#|javascript:|mailto:|tel:)/i.test(raw)) return;
    let href;
    try {
      href = new URL(raw, url).href;
    } catch {
      return;
    }
    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ label, href });
  });
  return links.slice(0, 8);
}

async function summarize(text) {
  return chat({
    system:
      "You are a spoken assistant for a blind user. Summarize this web page in 2 to 3 " +
      "short sentences that read well aloud. Say what the page is and its main point. " +
      "No markdown, no lists.",
    prompt: `PAGE:\n"""${text}"""\n\nSpoken summary:`,
  });
}

// Load a URL, summarize it, and return it plus its links as the new context.
async function openPage(url) {
  let page;
  try {
    page = await fetchArticleText(url, { maxChars: 4500 });
  } catch {
    return {
      skill: "browse",
      speak: `I couldn't open that page. Please check the address and try again.`,
      actions: ["Try another address", "Ask a question instead"],
      context: null,
    };
  }
  const [summary, links] = await Promise.all([summarize(page.text), fetchLinks(url)]);
  const linkList = links.length
    ? ` I found some links you can follow: ${links
        .map((l, i) => `${i + 1}. ${l.label}`)
        .join(". ")}. Say "go to" and the name to open one, or ask me something else.`
    : " I didn't find any links to follow here.";

  return {
    skill: "browse",
    speak: (summary.trim() || "Here's what's on that page.") + linkList,
    actions: links.map((l) => `Go to ${l.label}`).concat(["Ask me something else"]),
    data: { url, links },
    context: { skill: "browse", url, links },
  };
}

// Match the user's spoken words against the remembered links.
function matchLink(text, links) {
  const t = (text || "").toLowerCase();
  // Strip navigation verbs so "go to the about page" matches "About".
  const target = t.replace(/\b(go|to|the|open|visit|read|page|please|about page)\b/g, " ").trim();
  let best = null;
  for (const l of links || []) {
    const label = l.label.toLowerCase();
    if (t.includes(label) || (target && (label.includes(target) || target.includes(label)))) {
      if (!best || l.label.length < best.label.length) best = l;
    }
  }
  // Also allow "go to number 2".
  const num = t.match(/\b(\d+)\b/);
  if (!best && num && links && links[Number(num[1]) - 1]) best = links[Number(num[1]) - 1];
  return best;
}

export async function browse(query, context, transcript) {
  const text = transcript || query || "";

  // Follow-up navigation within a page we already summarized.
  if (context && context.skill === "browse" && Array.isArray(context.links)) {
    const url = firstUrl(text);
    if (url) return openPage(url);
    const link = matchLink(text, context.links);
    if (link) return openPage(link.href);
    // Couldn't match — re-offer the options.
    return {
      skill: "browse",
      speak:
        `I'm not sure which link you meant. Your options are: ` +
        context.links.map((l, i) => `${i + 1}. ${l.label}`).join(". ") +
        `. Say "go to" and the name, or ask me something else.`,
      actions: context.links.map((l) => `Go to ${l.label}`).concat(["Ask me something else"]),
      context,
    };
  }

  // Fresh request — need a URL.
  const url = firstUrl(text) || (query && firstUrl(query));
  if (!url) {
    return {
      skill: "browse",
      speak:
        "Tell me a web address and I'll read the page and summarize it for you, then offer links you can follow.",
      actions: ["Say a website address", "Ask a question instead"],
    };
  }
  return openPage(url);
}
