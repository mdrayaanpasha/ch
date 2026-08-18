// Web Speech API wrapper (Chrome-native, no keys), hardened for an audio-first
// experience. The big reliability fixes over a naive implementation:
//   1. Voices are loaded before the first utterance (getVoices() starts empty).
//   2. A generation counter serializes speak() calls, so a new response cleanly
//      supersedes an in-flight one instead of two loops fighting over the engine
//      (the usual cause of "sometimes no audio").
//   3. A small delay after cancel() avoids Chrome's cancel-then-speak race.
//   4. Long text is chunked + a keepalive resume() prevents the ~15s cutoff.

const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
const SpeechRecognition =
  typeof window !== "undefined" &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

export function isSupported() {
  return Boolean(SpeechRecognition);
}
export function ttsSupported() {
  return Boolean(synth);
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// --- voices ------------------------------------------------------------------
function loadVoices() {
  return new Promise((resolve) => {
    if (!synth) return resolve([]);
    const have = synth.getVoices();
    if (have && have.length) return resolve(have);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve(synth.getVoices());
    };
    synth.onvoiceschanged = finish;
    setTimeout(finish, 700); // fallback if the event never fires
  });
}

function pickVoice(voices) {
  return (
    voices.find((v) => /en[-_]US/i.test(v.lang) && /Samantha|Google US English|female/i.test(v.name)) ||
    voices.find((v) => /en[-_]US/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    voices[0] ||
    null
  );
}

// Split into sentence-ish chunks under ~180 chars — avoids Chrome's long-text cutoff.
function chunk(text) {
  const clean = String(text).replace(/\s+/g, " ").trim();
  const sentences = clean.match(/[^.!?]+[.!?]*/g) || [clean];
  const parts = [];
  let buf = "";
  for (const s of sentences) {
    if ((buf + s).length > 180) {
      if (buf.trim()) parts.push(buf.trim());
      buf = s;
    } else {
      buf += s;
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

// Generation token: every stopSpeaking()/new speak() bumps it, invalidating any
// loop still running from a previous call.
let gen = 0;

export function stopSpeaking() {
  gen++;
  if (synth) synth.cancel();
}

function speakOnce(part, voice, stillCurrent) {
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(part);
    if (voice) u.voice = voice;
    u.rate = 1;
    u.pitch = 1;
    // Keepalive: Chrome pauses long speech; nudge it back while it's ours.
    const keepAlive = setInterval(() => {
      if (!stillCurrent() || !synth.speaking) return clearInterval(keepAlive);
      synth.pause();
      synth.resume();
    }, 4000);
    const finish = () => {
      clearInterval(keepAlive);
      resolve();
    };
    u.onend = finish;
    u.onerror = finish;
    synth.speak(u);
  });
}

// Speak text aloud, resolving only when finished (or superseded). Recites the
// entire response, chunk by chunk.
export async function speak(text) {
  if (!text || !synth) return;
  const myGen = ++gen; // supersede any in-flight speak
  const voices = await loadVoices();
  if (myGen !== gen) return;
  const voice = pickVoice(voices);
  synth.cancel();
  await delay(90); // let the cancel settle before speaking (Chrome race)
  if (myGen !== gen) return;
  const stillCurrent = () => myGen === gen;
  for (const part of chunk(text)) {
    if (!stillCurrent()) return;
    await speakOnce(part, voice, stillCurrent);
  }
}

// Unlock audio inside a user gesture. Browsers stay muted until speak() is first
// invoked from a real click/keypress; a silent utterance primes the engine.
export function warmup() {
  if (!synth) return;
  synth.resume();
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  synth.speak(u);
}

// --- earcons (non-speech cues, so they never collide with the recited reply) --
// WebAudio is separate from speech synthesis. If the audio device/renderer
// errors, we permanently disable earcons and stay silent — spoken responses are
// unaffected. Earcons are a nicety; the recited reply is what matters.
let audioCtx = null;
let audioDisabled = false;

function getCtx() {
  if (audioDisabled) return null;
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) {
      audioDisabled = true;
      return null;
    }
    if (!audioCtx) {
      audioCtx = new Ctor();
      audioCtx.onerror = () => { audioDisabled = true; };
    }
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    if (audioCtx.state === "closed") {
      audioDisabled = true;
      return null;
    }
    return audioCtx;
  } catch {
    audioDisabled = true;
    return null;
  }
}

function tone(c, freq, when, dur, vol = 0.06) {
  try {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.value = vol;
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(when);
    osc.stop(when + dur);
    osc.onended = () => {
      try { osc.disconnect(); gain.disconnect(); } catch { /* ignore */ }
    };
  } catch {
    audioDisabled = true; // give up on earcons, keep speech working
  }
}
// Rising blip — "mic is open, speak now".
export function beepListen() {
  const c = getCtx();
  if (!c) return;
  tone(c, 660, c.currentTime, 0.12);
  tone(c, 880, c.currentTime + 0.13, 0.12);
}
// Low double-tick — "working on it".
export function beepThinking() {
  const c = getCtx();
  if (!c) return;
  tone(c, 440, c.currentTime, 0.08, 0.04);
  tone(c, 440, c.currentTime + 0.2, 0.08, 0.04);
}

// Listen for a single utterance. Resolves with the transcript string.
export function listen() {
  return new Promise((resolve, reject) => {
    if (!SpeechRecognition) return reject(new Error("Speech recognition not supported"));
    const rec = new SpeechRecognition();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    let done = false;
    rec.onresult = (e) => {
      done = true;
      resolve(e.results[0][0].transcript);
    };
    rec.onerror = (e) => {
      done = true;
      reject(new Error(e.error || "recognition error"));
    };
    rec.onend = () => {
      if (!done) reject(new Error("no-speech"));
    };
    rec.start();
  });
}
