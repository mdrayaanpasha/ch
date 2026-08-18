import { useMemo, useState } from "react";
import { EXAMPLES } from "./biasData.js";

// Frontend-only prototype of the bias-detector pipeline. It reads from the
// hand-validated fixtures in biasData.js instead of calling the live
// orchestrator, so the demo is reproducible and needs no Ollama. The staged
// "analyzing" animation mimics the real fan-out → debate → judge flow.

const STAGES = [
  "Normalizing input…",
  "Fanning out to detectors: omission, framing, fear…",
  "Running debate: advocates → skeptic → rebuttal…",
  "Judge synthesizing verdict…",
];

const VERDICT_STYLE = {
  biased: { label: "BIASED", cls: "v-biased" },
  "mostly-neutral": { label: "MOSTLY NEUTRAL", cls: "v-mostly" },
  neutral: { label: "NEUTRAL", cls: "v-neutral" },
  unknown: { label: "UNKNOWN", cls: "v-unknown" },
};

function sevClass(s) {
  if (s >= 7) return "sev-high";
  if (s >= 4) return "sev-mid";
  return "sev-low";
}

function SeverityBar({ value }) {
  return (
    <div className="sevbar" role="img" aria-label={`severity ${value} out of 10`}>
      <span className={`sevfill ${sevClass(value)}`} style={{ width: `${value * 10}%` }} />
      <span className="sevnum">{value}/10</span>
    </div>
  );
}

export default function BiasDemo() {
  const [selectedId, setSelectedId] = useState(EXAMPLES[0].id);
  const [phase, setPhase] = useState("idle"); // idle | analyzing | done
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState(null);

  const selected = useMemo(
    () => EXAMPLES.find((e) => e.id === selectedId) ?? EXAMPLES[0],
    [selectedId]
  );

  const analyze = () => {
    setPhase("analyzing");
    setResult(null);
    setStage(0);
    // Walk the staged animation, then reveal the pre-baked result.
    let i = 0;
    const tick = () => {
      i += 1;
      if (i < STAGES.length) {
        setStage(i);
        setTimeout(tick, 650);
      } else {
        setResult(selected.result);
        setPhase("done");
      }
    };
    setTimeout(tick, 650);
  };

  const pick = (id) => {
    setSelectedId(id);
    setPhase("idle");
    setResult(null);
  };

  const verdict = result?.verdict;
  const vStyle = verdict ? VERDICT_STYLE[verdict.overallVerdict] ?? VERDICT_STYLE.unknown : null;

  return (
    <main className="app bias">
      <div className="badge">PROTOTYPE · fixed validated responses</div>
      <h1>Bias Detector</h1>
      <p className="tagline">
        Multi-agent pipeline: three focused detectors (omission · framing · fear) → a debate →
        a judge’s verdict. This demo runs on hand-validated sample data.
      </p>

      {/* Example picker */}
      <h2 className="section">1 · Pick an example</h2>
      <div className="examples">
        {EXAMPLES.map((e) => (
          <button
            key={e.id}
            className={`example ${e.id === selectedId ? "sel" : ""}`}
            onClick={() => pick(e.id)}
          >
            <span className={`kind ${e.kind}`}>{e.kind === "url" ? "🔗 URL" : "📝 Prompt"}</span>
            <span className="ex-label">{e.label}</span>
            <span className="ex-blurb">{e.blurb}</span>
          </button>
        ))}
      </div>

      {/* Input preview */}
      <div className="inputbox">
        {selected.kind === "url" ? (
          <a className="urlline" href={selected.input} onClick={(ev) => ev.preventDefault()}>
            {selected.input}
          </a>
        ) : (
          <p className="promptline">“{selected.input}”</p>
        )}
        <button className="analyzeBtn" onClick={analyze} disabled={phase === "analyzing"}>
          {phase === "analyzing" ? "Analyzing…" : "▶ Analyze"}
        </button>
      </div>

      {/* Staged loader */}
      {phase === "analyzing" && (
        <ul className="stages" aria-live="polite">
          {STAGES.map((s, i) => (
            <li key={i} className={i <= stage ? "on" : ""}>
              <span className="dot">{i < stage ? "✓" : i === stage ? "…" : "•"}</span> {s}
            </li>
          ))}
        </ul>
      )}

      {/* Results */}
      {result && (
        <>
          <h2 className="section">2 · Detector findings</h2>
          <div className="findings">
            {result.findings.map((f) => (
              <div key={f.bias} className={`finding ${f.detected ? "hit" : "clean"}`}>
                <div className="fhead">
                  <span className="fbias">{f.bias}</span>
                  <span className={`ftag ${f.detected ? "t-hit" : "t-clean"}`}>
                    {f.detected ? "detected" : "clean"}
                  </span>
                </div>
                <SeverityBar value={f.severity} />
                <p className="fexpl">{f.explanation}</p>
                {f.evidence?.length > 0 && (
                  <ul className="evidence">
                    {f.evidence.map((ev, i) => (
                      <li key={i}>“{ev}”</li>
                    ))}
                  </ul>
                )}
                {f.baseline && (
                  <p className="baseline">
                    <span>generic baseline:</span> {f.baseline.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>

          <h2 className="section">3 · Debate transcript</h2>
          <div className="debate">
            {result.debate.transcript.map((r, i) => (
              <div key={i} className={`round r-${r.round}`}>
                <div className="rname">{r.round}</div>
                {r.entries ? (
                  <ul className="rentries">
                    {r.entries.map((e, j) => (
                      <li key={j}>
                        <b>{e.bias}:</b> {e.statement}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rcontent">{r.content}</p>
                )}
              </div>
            ))}
          </div>

          <h2 className="section">4 · Judge verdict</h2>
          <div className={`verdict ${vStyle.cls}`}>
            <div className="vhead">
              <span className="vlabel">{vStyle.label}</span>
            </div>
            <ul className="vperbias">
              {verdict.perBias.map((p) => (
                <li key={p.bias}>
                  <span className="vb">{p.bias}</span>
                  <span className={`vsev ${sevClass(p.finalSeverity)}`}>{p.finalSeverity}/10</span>
                  <span className="vnote">{p.note}</span>
                </li>
              ))}
            </ul>
            <p className="vrationale">{verdict.rationale}</p>
          </div>
        </>
      )}
    </main>
  );
}
