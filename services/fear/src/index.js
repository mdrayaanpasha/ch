// Fear / emotional-bias microservice (:5003).
// Focused single-purpose prompt vs. a generic "check for bias" baseline.
import express from "express";
import cors from "cors";
import { focusedVsGeneric } from "../../../shared/focusedDetector.js";

const app = express();
const PORT = process.env.PORT || 5003;
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const FOCUSED_SYSTEM = `You are a fear/emotional-manipulation detector. You do ONE
thing: find appeals to fear and emotional manipulation. Look for threat and danger
language, catastrophizing (worst-case framed as likely), manufactured urgency
("act now", "before it's too late"), dread and doom vocabulary, appeals to safety
of loved ones, and scare statistics used to provoke rather than inform. Ignore
factual accuracy and other bias types. Quote the exact emotionally charged spans.
Respond only in JSON.`;

const focusedPrompt = (text) =>
  `Analyze the TEXT for FEAR / EMOTIONAL bias only.\n\nTEXT:\n"""${text}"""\n\n` +
  `Respond as JSON:\n{\n` +
  `  "detected": boolean,\n` +
  `  "severity": integer 0-10,\n` +
  `  "evidence": [ "exact quoted span with fear/emotional language", ... ],\n` +
  `  "explanation": "one paragraph naming the emotional techniques used"\n}`;

app.get("/health", (_req, res) => res.json({ status: "ok", service: "fear" }));

app.post("/analyze", async (req, res) => {
  const text = req.body?.text;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "body.text (string) is required" });
  }
  try {
    const result = await focusedVsGeneric({
      bias: "fear",
      focusedSystem: FOCUSED_SYSTEM,
      focusedPrompt,
      text,
    });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
});

app.listen(PORT, () => console.log(`[fear]     listening on http://localhost:${PORT}`));
