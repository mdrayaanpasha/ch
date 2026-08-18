// Resume skill — a stateful, voice-driven Q&A. The client echoes `context` back
// each turn (the router sends mid-flow turns straight here). We collect one
// answer per question, then have the LLM assemble a clean resume, read back a
// summary, and return the full text as `data.resume` for on-screen display /
// download.
import { chat } from "../../../../shared/ollama.js";

const QUESTIONS = [
  { key: "name", ask: "Let's build your resume. First, what's your full name?" },
  { key: "role", ask: "What role or job title are you aiming for?" },
  { key: "skills", ask: "List a few of your top skills." },
  { key: "experience", ask: "Briefly describe your most recent work experience — company, role, and what you did." },
  { key: "education", ask: "Finally, what's your highest education or a relevant qualification?" },
];

function fresh() {
  return { skill: "resume", step: 0, answers: {}, done: false };
}

export async function resume(transcript, context) {
  // First entry into the skill: `context` is null (or not a resume session).
  // The transcript ("make my resume") is the trigger, not an answer — ask Q1.
  if (!context || context.skill !== "resume") {
    const state = fresh();
    return {
      skill: "resume",
      speak: QUESTIONS[0].ask,
      actions: ["Answer out loud", "Cancel"],
      context: state,
    };
  }

  // Mid-flow: the transcript answers QUESTIONS[context.step].
  const state = {
    skill: "resume",
    step: context.step,
    answers: { ...(context.answers || {}) },
    done: false,
  };
  const current = QUESTIONS[state.step];
  if (current) state.answers[current.key] = transcript;
  state.step += 1;

  // More questions to go → ask the next one.
  if (state.step < QUESTIONS.length) {
    return {
      skill: "resume",
      speak: QUESTIONS[state.step].ask,
      actions: ["Answer out loud", "Cancel"],
      context: state,
    };
  }

  // All answers collected → generate the resume.
  const a = state.answers;
  const resumeText = await chat({
    system:
      "You are a professional resume writer. Turn the applicant's answers into a " +
      "clean, well-structured plain-text resume with clear section headings " +
      "(Name, Target Role, Summary, Skills, Experience, Education). Keep it concise " +
      "and professional. Do not invent facts beyond what's given.",
    prompt:
      `Applicant answers:\n` +
      `Name: ${a.name || ""}\n` +
      `Target role: ${a.role || ""}\n` +
      `Skills: ${a.skills || ""}\n` +
      `Experience: ${a.experience || ""}\n` +
      `Education: ${a.education || ""}\n\n` +
      `Write the resume:`,
    temperature: 0.4,
  });

  return {
    skill: "resume",
    speak: `All done — I've drafted a resume for ${a.name || "you"} targeting ${a.role || "your role"}. It's shown on screen, and you can download it. Would you like to make any changes?`,
    actions: ["Download the resume", "Start over", "Search for jobs"],
    data: { resume: resumeText.trim() },
    context: { ...state, done: true },
  };
}
