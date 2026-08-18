// Intent router: one small LLM classification into a fixed enum, then dispatch.
// A local model stays reliable when the label set is tiny and closed. Multi-turn
// skills (resume, browse, jobs) are routed by `context` first so a follow-up
// like "go to the about page" or "apply for job 3" continues the flow instead of
// being re-classified from scratch.
import { chatJSON } from "../../../shared/ollama.js";
import { info } from "./skills/info.js";
import { browse } from "./skills/browse.js";
import { jobs } from "./skills/jobs.js";
import { resume } from "./skills/resume.js";

const SKILLS = { info, browse, jobs, resume };

const firstUrl = (s) => (String(s).match(/https?:\/\/\S+/i) || [null])[0];

async function classify(transcript) {
  const out = await chatJSON({
    system:
      "You route a blind user's spoken command to exactly one skill in a voice web " +
      "assistant. Choose the single best skill. Respond only in JSON.",
    prompt:
      `SKILLS:\n` +
      `- "info": answer a factual question or explain a topic (e.g. "tell me about the Eiffel Tower", "what is a mutual fund").\n` +
      `- "browse": open a web page / URL, summarize it aloud, and follow its links (e.g. "summarize this page", "read this website", any command with a link).\n` +
      `- "jobs": anything about jobs/work for blind users — list new jobs, hear a job, or apply (e.g. "tell me about new jobs", "apply for job 3", "any openings").\n` +
      `- "resume": build or edit the user's resume / CV (e.g. "make my resume", "help me write a CV").\n\n` +
      `COMMAND: "${transcript}"\n\n` +
      `Respond as JSON: {"skill": "info"|"browse"|"jobs"|"resume", "query": string}\n` +
      `"query" is the cleaned search term, topic, or URL.`,
  });
  const skill = SKILLS[out?.skill] ? out.skill : "info";
  const query = String(out?.query || transcript).trim();
  return { skill, query };
}

export async function route(transcript, context) {
  const skillOf = context && context.skill;

  // 1. Mid-flow resume Q&A — the user is answering, not issuing a new command.
  if (skillOf === "resume" && !context.done) {
    return resume(transcript, context, transcript);
  }

  // 2. Follow-up navigation on a page we're already browsing.
  if (skillOf === "browse" && /\b(go|open|visit|read|next|option|link|about|home|contact|\d)\b/i.test(transcript)) {
    return browse(transcript, context, transcript);
  }

  // 3. Follow-up on a job listing (a number, "apply", "another").
  if (skillOf === "jobs" && /\b(apply|job|number|another|again|first|second|third|fourth|fifth|\d)\b/i.test(transcript)) {
    return jobs(transcript, context, transcript);
  }

  // 4. A URL anywhere → browse it.
  if (firstUrl(transcript)) {
    return browse(firstUrl(transcript), context, transcript);
  }

  // 5. Unambiguous keyword shortcuts — voice recognition + a small local model
  //    are more reliable when we don't route obvious commands through the LLM.
  if (/\bappl(y|ied|ication)\b/i.test(transcript) || /\b(new|any|remote|available)?\s*jobs?\b/i.test(transcript) || /\bopenings?\b/i.test(transcript)) {
    return jobs(transcript, context, transcript);
  }
  if (/\b(make|build|write|create)\b.*\b(resume|cv)\b/i.test(transcript) || /\bmy resume\b/i.test(transcript)) {
    return resume(transcript, context, transcript);
  }
  if (/\b(summar(y|ize|ise)|read (this|the) (page|site|website|article)|open the website)\b/i.test(transcript)) {
    return browse(transcript, context, transcript);
  }

  // 6. Otherwise classify and dispatch.
  const { skill, query } = await classify(transcript);
  return SKILLS[skill](query, context, transcript);
}
