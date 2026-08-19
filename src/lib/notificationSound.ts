// Shared notification chime. Uses the Web Audio API so no asset download is
// needed and it still plays when the tab is in the background.
export function playPing(frequency = 880) {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
  } catch {
    /* ignore — audio is best-effort */
  }
}

// Two-tone chime for incoming client messages so they're distinguishable
// from team chat pings.
export function playMessageChime() {
  playPing(660);
  setTimeout(() => playPing(990), 140);
}
