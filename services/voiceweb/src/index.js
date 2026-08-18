// VoiceWeb service (:5010) — the single backend the voice UI talks to.
// POST /api/act { transcript, context? } → { skill, speak, actions, data?, context? }.
// The frontend speaks `speak` aloud and offers `actions` as follow-ups. `context`
// is opaque state the client echoes back (used by the multi-turn resume skill).
import express from "express";
import cors from "cors";
import { route } from "./router.js";

const app = express();
const PORT = process.env.PORT || 5010;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", service: "voiceweb", time: new Date().toISOString() })
);

app.post("/api/act", async (req, res) => {
  const transcript = req.body?.transcript;
  const context = req.body?.context ?? null;
  if (!transcript || typeof transcript !== "string") {
    return res.status(400).json({ error: "body.transcript (string) is required" });
  }
  try {
    const result = await route(transcript.trim(), context);
    res.json(result);
  } catch (err) {
    res.status(502).json({
      skill: "error",
      speak: "Sorry, something went wrong on my end. Please try again.",
      actions: [],
      error: String(err.message || err),
    });
  }
});

app.listen(PORT, () => console.log(`[voiceweb] listening on http://localhost:${PORT}`));
