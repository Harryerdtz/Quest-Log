// audio.js — 8-bit SFX via Web Audio API
let ctx = null;
function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

function tone(freq, duration, type = "square", gain = 0.15) {
  const c = getCtx();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration);
}

export function playComplete() {
  tone(523, 0.08); setTimeout(() => tone(659, 0.08), 80); setTimeout(() => tone(784, 0.12), 160);
}
export function playLevelUp() {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.12), i * 100));
}
export function playDelete() {
  tone(220, 0.1, "sawtooth", 0.12);
}
export function playError() {
  tone(180, 0.15, "square", 0.1);
}
export function playCoin() {
  tone(1047, 0.06, "square", 0.1);
  setTimeout(() => tone(1319, 0.1, "square", 0.09), 70);
}
