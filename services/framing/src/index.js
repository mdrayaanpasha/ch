// Framing-bias microservice (:5002).
// Focused single-purpose prompt vs. a generic "check for bias" baseline.
import express from "express";
import cors from "cors";
import { focusedVsGeneric } from "../../../shared/focusedDetector.js";

const app = express();
const PORT = process.env.PORT || 5002;
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const FOCUSED_SYSTEM = `You are a framing-bias detector. You do ONE thing: find framing bias.
Framing bias is HOW something is presented rather than what is true — loaded or
emotionally charged word choice, selective emphasis, presupposition (assuming a
contested claim as given), agenda-setting (which facts are foregrounded vs buried),
false balance, and gain-vs-loss framing. Ignore factual accuracy and other bias
types. Quote the exact spans that carry the framing. Respond only in JSON.`;

const focusedPrompt = (text) =>
  `Analyze the TEXT for FRAMING bias only.\n\nTEXT:\n"""${text}"""\n\n` +
  `Respond as JSON:\n{\n` +
  `  "detected": boolean,\n` +
  `  "severity": integer 0-10,\n` +
  `  "evidence": [ "exact quoted span that carries framing", ... ],\n` +
  `  "explanation": "one paragraph naming the framing techniques used"\n}`;

app.get("/health", (_req, res) => res.json({ status: "ok", service: "framing" }));

app.post("/analyze", async (req, res) => {
  const text = req.body?.text;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "body.text (string) is required" });
  }
  try {
    const result = await focusedVsGeneric({
      bias: "framing",
      focusedSystem: FOCUSED_SYSTEM,
      focusedPrompt,
      text,
    });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
});

app.listen(PORT, () => console.log(`[framing]  listening on http://localhost:${PORT}`));
