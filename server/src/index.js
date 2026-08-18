// Orchestrator HTTP server (:5000) — the master. Keeps the existing /api/health
// and the Vite /api proxy, and adds POST /api/analyze.
import express from "express";
import cors from "cors";
import { analyze } from "./orchestrator.js";

const app = express();
// 5050, not 5000 — macOS ControlCenter (AirPlay Receiver) squats on :5000.
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "orchestrator", time: new Date().toISOString() });
});

// Master entrypoint: accepts a raw prompt OR a web link.
app.post("/api/analyze", async (req, res) => {
  const input = req.body?.input;
  if (!input || typeof input !== "string") {
    return res.status(400).json({ error: "body.input (string: prompt or url) is required" });
  }
  try {
    const result = await analyze(input.trim());
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
});

app.listen(PORT, () => console.log(`[orchestrator] listening on http://localhost:${PORT}`));
