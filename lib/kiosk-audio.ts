let audioCtx: AudioContext | null = null;

function context() {
  if (typeof window === "undefined") return null;
  audioCtx ??= new AudioContext();
  return audioCtx;
}

export async function unlockKioskAudio() {
  const ctx = context();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
}

function beep(
  ctx: AudioContext,
  freq: number,
  when: number,
  duration: number,
  type: OscillatorType,
  peak: number
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(peak, when + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + duration + 0.03);
}

function reducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function playGateOpenSound() {
  const ctx = context();
  if (!ctx || reducedMotion()) return;
  void ctx.resume();
  const t = ctx.currentTime + 0.02;
  beep(ctx, 523.25, t, 0.12, "triangle", 0.07);
  beep(ctx, 659.25, t + 0.09, 0.12, "triangle", 0.08);
  beep(ctx, 783.99, t + 0.18, 0.14, "sine", 0.09);
  beep(ctx, 1046.5, t + 0.3, 0.32, "sine", 0.11);
  beep(ctx, 1318.5, t + 0.34, 0.16, "triangle", 0.04);
  try {
    navigator.vibrate?.(50);
  } catch {
    /* ignore */
  }
}

export function playGateCloseSound() {
  const ctx = context();
  if (!ctx || reducedMotion()) return;
  void ctx.resume();
  const t = ctx.currentTime + 0.02;
  beep(ctx, 783.99, t, 0.12, "sine", 0.06);
  beep(ctx, 659.25, t + 0.11, 0.12, "triangle", 0.05);
  beep(ctx, 523.25, t + 0.22, 0.22, "sine", 0.05);
}

export function playDeniedSound() {
  const ctx = context();
  if (!ctx || reducedMotion()) return;
  void ctx.resume();
  const t = ctx.currentTime + 0.02;
  beep(ctx, 220, t, 0.16, "sine", 0.05);
  beep(ctx, 174.61, t + 0.14, 0.28, "triangle", 0.04);
}
