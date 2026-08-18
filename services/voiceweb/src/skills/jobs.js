// Jobs skill — our own curated listing of accessibility-friendly roles,
// presented as if aggregated from job boards. Supports three voice sub-intents,
// all resolved from the spoken transcript:
//   "tell me about new jobs"      → list roles with IDs
//   "job three" / "number 3"      → read that role's details
//   "apply for job 3"             → submit an application (demo confirmation)
// State (which roles were shown / applied to) rides along in `context`.

// Curated openings that are genuinely blind/low-vision friendly. In a real
// product these would come from a partner feed; here they are our own listing.
const JOBS = [
  {
    id: 1,
    title: "Customer Support Specialist",
    company: "BrightPath Software",
    location: "Remote — United States",
    pay: "$45,000 / year",
    accessibility: "Fully screen-reader compatible tools, flexible hours, audio-first onboarding.",
    desc: "Help customers by phone and chat, resolve account questions, and log issues. Great for strong listeners and clear communicators.",
  },
  {
    id: 2,
    title: "Audio Transcription Editor",
    company: "ClearVoice Media",
    location: "Remote — Worldwide",
    pay: "$28 / hour",
    accessibility: "Keyboard-only workflow, no visual review required, works with any screen reader.",
    desc: "Review and correct machine transcripts of podcasts and interviews. Sharp hearing and good grammar are the main skills.",
  },
  {
    id: 3,
    title: "Accessibility QA Tester",
    company: "Inclusive Apps Inc.",
    location: "Remote — US & Canada",
    pay: "$58,000 / year",
    accessibility: "You ARE the expert user — test apps with your own screen reader and report barriers.",
    desc: "Use websites and mobile apps with assistive technology and document what works and what doesn't. Lived experience valued.",
  },
  {
    id: 4,
    title: "Telephone Research Interviewer",
    company: "Insight Partners Research",
    location: "Remote — United States",
    pay: "$22 / hour",
    accessibility: "Phone-based, scripts provided as audio, no visual dashboards.",
    desc: "Conduct friendly survey calls and record answers through a voice-guided system. Flexible part-time shifts.",
  },
  {
    id: 5,
    title: "Content Writer & Proofreader",
    company: "Wordsmith Collective",
    location: "Remote — Worldwide",
    pay: "$40,000 / year",
    accessibility: "Text-only workflow, deadlines flexible, tools tested with NVDA and VoiceOver.",
    desc: "Write and polish blog posts and help articles. Strong writing and an ear for tone matter most.",
  },
];

// --- transcript parsing helpers ---------------------------------------------
const WORD_NUM = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6,
};

function parseId(text) {
  const t = (text || "").toLowerCase();
  const digit = t.match(/\b(\d+)\b/);
  if (digit) return Number(digit[1]);
  for (const [word, n] of Object.entries(WORD_NUM)) {
    if (new RegExp(`\\b${word}\\b`).test(t)) return n;
  }
  return null;
}

const wantsApply = (t) => /\bappl(y|ied|ication)\b/i.test(t || "");
const find = (id) => JOBS.find((j) => j.id === id);

function listAll() {
  const spoken = JOBS.map(
    (j) => `Job ${j.id}: ${j.title} at ${j.company}, ${j.location}, paying ${j.pay}.`
  ).join(" ");
  return {
    skill: "jobs",
    speak:
      `Here are ${JOBS.length} new openings suited for blind and low-vision workers. ` +
      spoken +
      ` Say a job number to hear the full details, or say "apply for job" and a number to apply.`,
    actions: JOBS.map((j) => `Job ${j.id}`).concat(["Apply for job 1", "Ask me something else"]),
    data: { jobs: JOBS },
    context: { skill: "jobs", appliedIds: [] },
  };
}

export function jobs(query, context, transcript) {
  const text = transcript || query || "";
  const id = parseId(text);
  const applied = (context && context.appliedIds) || [];

  // Apply intent → confirm the application (demo: recorded, not truly submitted).
  if (wantsApply(text) && id) {
    const job = find(id);
    if (!job) {
      return {
        skill: "jobs",
        speak: `I couldn't find job number ${id}. Say a number between 1 and ${JOBS.length}.`,
        actions: JOBS.map((j) => `Job ${j.id}`),
        context: { skill: "jobs", appliedIds: applied },
      };
    }
    const already = applied.includes(id);
    return {
      skill: "jobs",
      speak: already
        ? `You've already applied to ${job.title} at ${job.company}. Would you like to apply to a different role?`
        : `Done! I've submitted your application for ${job.title} at ${job.company}. They'll contact you by email. Would you like to apply to another, or hear other jobs?`,
      actions: ["Hear all jobs again", "Make my resume", "Ask me something else"],
      data: { appliedJob: job },
      context: { skill: "jobs", appliedIds: already ? applied : [...applied, id] },
    };
  }

  // A bare job number → read that role's details.
  if (id && !wantsApply(text)) {
    const job = find(id);
    if (!job) {
      return {
        skill: "jobs",
        speak: `I couldn't find job number ${id}. Say a number between 1 and ${JOBS.length}.`,
        actions: JOBS.map((j) => `Job ${j.id}`),
        context: { skill: "jobs", appliedIds: applied },
      };
    }
    return {
      skill: "jobs",
      speak:
        `Job ${job.id}, ${job.title} at ${job.company}. Location: ${job.location}. Pay: ${job.pay}. ` +
        `${job.desc} Accessibility: ${job.accessibility} ` +
        `To apply, say "apply for job ${job.id}".`,
      actions: [`Apply for job ${job.id}`, "Hear all jobs again", "Ask me something else"],
      data: { job },
      context: { skill: "jobs", appliedIds: applied },
    };
  }

  // Default → list everything.
  return listAll();
}
