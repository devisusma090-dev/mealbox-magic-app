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

function buzz(on: boolean) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(on ? [400, 200, 400, 200, 400] : 0);
  } catch {
    /* unsupported */
  }
}

/** Loud repeating chime + phone vibration until `stopAlarm()` is called. */
export function startAlarm() {
  const audio = ensureCtx();
  if (!audio || loop) return;
  siren(audio);
  buzz(true);
  loop = setInterval(() => {
    siren(audio);
    buzz(true);
  }, 1500);
}

export function stopAlarm() {
  if (loop) clearInterval(loop);
  loop = null;
  buzz(false);
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

let armed = false;
let pendingAlarm = false;
let pendingDing = false;

/**
 * Auto-resume: browsers block audio until the page has been interacted with.
 * The first pointer/key/touch event resumes the context and immediately plays
 * anything that was queued while it was suspended, so staff alerts chime
 * automatically without a manual "enable sound" tap.
 */
export function armAudio() {
  if (armed || typeof window === "undefined") return;
  armed = true;
  ensureCtx();
  const resume = () => {
    const audio = ensureCtx();
    if (!audio) return;
    void audio.resume().then(() => {
      if (pendingAlarm) {
        pendingAlarm = false;
        startAlarm();
      }
      if (pendingDing) {
        pendingDing = false;
        ding();
      }
    });
  };
  for (const ev of ["pointerdown", "keydown", "touchstart"] as const) {
    window.addEventListener(ev, resume, { passive: true });
  }
}

/** Plays now when audio is unlocked, otherwise on the next user interaction. */
export function alertNewOrder() {
  const audio = ensureCtx();
  if (!audio || audio.state !== "running") {
    pendingAlarm = true;
    armAudio();
    return;
  }
  startAlarm();
}

export function alertUpdate() {
  const audio = ensureCtx();
  if (!audio || audio.state !== "running") {
    pendingDing = true;
    armAudio();
    return;
  }
  ding();
}

