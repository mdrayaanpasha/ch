import { useCallback, useEffect, useRef, useState } from "react";
import {
  beepListen,
  beepThinking,
  isSupported,
  listen,
  speak,
  stopSpeaking,
  ttsSupported,
  warmup,
} from "./voice.js";

const GREETING =
  "Welcome to VoiceWeb, your talking web assistant. You can say: tell me about new jobs, " +
  "apply for a job, summarize a web page, ask me a question, or make my resume. " +
  "The microphone will open after this message. Just speak when you hear the beep.";

export default function App() {
  const [started, setStarted] = useState(false);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("");
  const [you, setYou] = useState("");
  const [reply, setReply] = useState("Tap the button to begin. I'll speak everything out loud.");
  const [actions, setActions] = useState([]);
  const [resumeText, setResumeText] = useState("");
  const [textInput, setTextInput] = useState("");
  const [handsFree, setHandsFree] = useState(true);

  // Refs mirror state so async callbacks read current values, not stale closures.
  const contextRef = useRef(null);
  const listeningRef = useRef(false);
  const handsFreeRef = useRef(true);
  useEffect(() => { handsFreeRef.current = handsFree; }, [handsFree]);

  const startListening = useCallback(async () => {
    if (listeningRef.current) return;
    stopSpeaking();
    listeningRef.current = true;
    setListening(true);
    setStatus("Listening…");
    beepListen(); // audible cue that the mic is open
    try {
      const transcript = await listen();
      listeningRef.current = false;
      setListening(false);
      await handle(transcript);
    } catch (err) {
      listeningRef.current = false;
      setListening(false);
      if (err.message === "no-speech") {
        setStatus("I didn't catch that.");
        await speak("I didn't catch that. Please try again.");
        if (handsFreeRef.current) startListening();
      } else {
        setStatus(String(err.message));
        await speak("The microphone had a problem. Please tap the button to try again.");
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Send a command to the backend, RECITE the full reply, then (hands-free) re-listen.
  const handle = useCallback(async (transcript) => {
    if (!transcript) return;
    const trimmed = transcript.trim();
    setYou(trimmed);

    // Local "stop" command — silence and leave hands-free mode.
    if (/^(stop|cancel|quiet|be quiet|pause|never mind)\.?$/i.test(trimmed)) {
      stopSpeaking();
      setHandsFree(false);
      handsFreeRef.current = false;
      setStatus("Stopped.");
      const msg = "Okay, I've stopped listening. Tap the button when you need me.";
      setReply(msg);
      await speak(msg);
      return;
    }

    setStatus("Thinking…");
    beepThinking(); // non-speech cue so it never collides with the reply
    try {
      const res = await fetch("/api/act", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcript: trimmed, context: contextRef.current }),
      });
      const data = await res.json();
      contextRef.current = data.context ?? null;
      const spoken = data.speak || "Done.";
      setReply(spoken);
      setActions(Array.isArray(data.actions) ? data.actions : []);
      setResumeText(data.data?.resume || "");
      setStatus("");
      await speak(spoken); // recite the entire response
      if (handsFreeRef.current) startListening(); // hands-free conversation loop
    } catch (err) {
      const msg = "Sorry, I couldn't reach the assistant. Please check the server is running.";
      setReply(msg);
      setStatus(String(err.message || err));
      await speak(msg);
    }
  }, [startListening]);

  // Space bar toggles the mic — one big, predictable hotkey.
  useEffect(() => {
    const onKey = (e) => {
      if (!started) return;
      if (e.code === "Space" && e.target.tagName !== "INPUT" && e.target.tagName !== "BUTTON") {
        e.preventDefault();
        startListening();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started, startListening]);

  // The start gate: this click is the user gesture that unlocks browser audio.
  const begin = useCallback(async () => {
    setStarted(true);
    warmup();
    setReply(GREETING);
    await speak(GREETING); // guaranteed to be heard — we're inside a gesture
    if (handsFreeRef.current) startListening();
  }, [startListening]);

  const submitText = (e) => {
    e.preventDefault();
    const t = textInput.trim();
    if (!t) return;
    setTextInput("");
    handle(t);
  };

  const resumeHref = resumeText
    ? "data:text/plain;charset=utf-8," + encodeURIComponent(resumeText)
    : null;

  // --- start overlay --------------------------------------------------------
  if (!started) {
    return (
      <main className="app gate">
        <h1>VoiceWeb</h1>
        <p className="tagline">A talking web assistant for blind &amp; low-vision users.</p>
        <button className="startBtn" onClick={begin} aria-label="Start VoiceWeb and enable audio">
          ▶ Tap anywhere to start
        </button>
        <p className="hint">
          {ttsSupported()
            ? "Tapping enables audio. I'll greet you, then listen automatically."
            : "Your browser may not support speech. Chrome works best."}
        </p>
      </main>
    );
  }

  return (
    <main className="app">
      <h1>VoiceWeb</h1>
      <p className="tagline">A talking web assistant — built for blind &amp; low-vision users.</p>

      <button
        className={`mic ${listening ? "listening" : ""}`}
        onClick={startListening}
        aria-label={listening ? "Listening, tap to restart" : "Tap and speak your request"}
      >
        <span aria-hidden="true">🎤</span>
        {listening ? "Listening…" : "Tap to speak"}
      </button>

      <div className="controls">
        <button className="ghost" onClick={() => speak(reply)} aria-label="Repeat the last response">
          🔊 Repeat that
        </button>
        <label className="toggle">
          <input
            type="checkbox"
            checked={handsFree}
            onChange={(e) => setHandsFree(e.target.checked)}
          />
          Hands-free (keep listening)
        </label>
      </div>

      <p className="hint">
        {isSupported()
          ? "Press the space bar to talk. Say “stop” to pause. You can also type below."
          : "Voice input needs Chrome. You can type your request below."}
      </p>

      <form className="fallback" onSubmit={submitText}>
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Type a request, e.g. tell me about new jobs"
          aria-label="Type your request"
        />
        <button type="submit">Send</button>
      </form>

      <p className="status" role="status" aria-live="polite">{status}</p>

      {you && (
        <div className="turn">
          <p className="you">You said: “{you}”</p>
        </div>
      )}

      {/* assertive so a screen reader announces the assistant's answer immediately */}
      <div className="reply" role="region" aria-live="assertive" aria-label="Assistant response">
        {reply}
      </div>

      {actions.length > 0 && (
        <ul className="actions" aria-label="Things you can do next">
          {actions.map((a, i) => (
            <li key={i}>
              <button onClick={() => handle(a)}>{a}</button>
            </li>
          ))}
        </ul>
      )}

      {resumeText && (
        <>
          <pre className="resume" aria-label="Your generated resume">{resumeText}</pre>
          <a className="download" href={resumeHref} download="resume.txt">
            ⬇ Download resume.txt
          </a>
        </>
      )}
    </main>
  );
}
