let ctx: AudioContext | null = null;
let loop: ReturnType<typeof setInterval> | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function siren(audio: AudioContext) {
  const now = audio.currentTime;
  const gain = audio.createGain();
  gain.connect(audio.destination);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.35, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);

  const osc = audio.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(660, now);
  osc.frequency.linearRampToValueAtTime(1180, now + 0.35);
  osc.frequency.linearRampToValueAtTime(660, now + 0.7);
  osc.frequency.linearRampToValueAtTime(1180, now + 1.05);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 1.2);
}

/** Loud repeating chime that keeps going until `stopAlarm()` is called. */
export function startAlarm() {
  const audio = ensureCtx();
  if (!audio || loop) return;
  siren(audio);
  loop = setInterval(() => siren(audio), 1500);
}

export function stopAlarm() {
  if (loop) clearInterval(loop);
  loop = null;
}

/** One-shot pleasant ding, for non-urgent updates. */
export function ding() {
  const audio = ensureCtx();
  if (!audio) return;
  const now = audio.currentTime;
  const gain = audio.createGain();
  gain.connect(audio.destination);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
  const osc = audio.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(1320, now + 0.3);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.65);
}

/** Must be called from a user gesture so browsers allow audio playback later. */
export function primeAudio() {
  ensureCtx();
}
