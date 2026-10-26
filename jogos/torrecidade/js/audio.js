let context = null,
  muted = false;
export function unlock() {
  context ??= new (window.AudioContext || window.webkitAudioContext)();
  context.resume();
}
export function mute() {
  muted = !muted;
  return muted;
}
export function sound(type = "encaixe") {
  if (!context || muted) return;
  const now = context.currentTime,
    o = context.createOscillator(),
    g = context.createGain();
  o.type = type === "vitoria" ? "sine" : "triangle";
  o.frequency.setValueAtTime(type === "vitoria" ? 660 : 340, now);
  o.frequency.exponentialRampToValueAtTime(
    type === "vitoria" ? 990 : 100,
    now + 0.13,
  );
  g.gain.setValueAtTime(0.045, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  o.connect(g).connect(context.destination);
  o.start(now);
  o.stop(now + 0.2);
  if (type === "encaixe" && navigator.vibrate) navigator.vibrate(15);
}
