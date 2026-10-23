// Procedural sound effects via WebAudio. No audio files required.
let ctx = null, master = null, enabled = true, volume = 0.8;
const noiseBuffers = {};

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination);
  } catch (e) { ctx = null; }
}
export function setVolume(v) { volume = v; if (master) master.gain.value = v; }
export function setEnabled(v) { enabled = v; }

function noiseBuf(len = 1) {
  const key = len;
  if (noiseBuffers[key]) return noiseBuffers[key];
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
  const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noiseBuffers[key] = b; return b;
}
function env(g, t0, a, d, peak = 1, sustain = 0) { g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t0 + a + d); }
function panner(x = 0, dist = 0) {
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (p) p.pan.value = Math.max(-1, Math.min(1, x));
  const g = ctx.createGain(); g.gain.value = 1 / (1 + dist * 0.06);
  if (p) { g.connect(p); p.connect(master); } else g.connect(master);
  return g;
}

export function sfx(name, opts = {}) {
  if (!ctx || !enabled) return;
  if (ctx.state === 'suspended') ctx.resume();
  const t = ctx.currentTime;
  const out = panner(opts.pan || 0, opts.dist || 0);
  const vol = (opts.vol ?? 1);
  switch (name) {
    case 'shot': {
      // body: filtered noise burst; crack: short sine sweep
      const kind = opts.kind || 'ar';
      const cfg = { smg: [0.06, 2200, 0.6], ar: [0.09, 1600, 0.8], shotgun: [0.16, 900, 1.2], sniper: [0.22, 700, 1.3], pistol: [0.07, 1800, 0.7], revolver: [0.12, 1100, 1.0], lmg: [0.1, 1300, 0.9], suppressed: [0.05, 2600, 0.3] }[kind] || [0.08, 1600, 0.8];
      const n = ctx.createBufferSource(); n.buffer = noiseBuf(0.5);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(cfg[1] * 2, t); f.frequency.exponentialRampToValueAtTime(cfg[1] * 0.3, t + cfg[0]);
      const g = ctx.createGain(); env(g, t, 0.002, cfg[0], 0.9 * cfg[2] * vol);
      n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + cfg[0] + 0.05);
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(kind === 'suppressed' ? 400 : 180, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.08);
      const og = ctx.createGain(); env(og, t, 0.001, 0.08, 0.5 * cfg[2] * vol);
      o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.1);
      break;
    }
    case 'explosion': {
      const n = ctx.createBufferSource(); n.buffer = noiseBuf(1.5);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(80, t + 1.2);
      const g = ctx.createGain(); env(g, t, 0.005, 1.2, 1.4 * vol);
      n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + 1.5);
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(25, t + 0.7);
      const og = ctx.createGain(); env(og, t, 0.005, 0.7, 1.0 * vol); o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.8);
      break;
    }
    case 'hit': { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = opts.kill ? 520 : 820; const g = ctx.createGain(); env(g, t, 0.001, opts.kill ? 0.12 : 0.05, 0.25 * vol); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.15);
      if (opts.kill) { const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 390; const g2 = ctx.createGain(); env(g2, t + 0.06, 0.001, 0.12, 0.25 * vol); o2.connect(g2); g2.connect(out); o2.start(t + 0.06); o2.stop(t + 0.25); }
      break; }
    case 'hurt': { const n = ctx.createBufferSource(); n.buffer = noiseBuf(0.3); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 300; const g = ctx.createGain(); env(g, t, 0.005, 0.15, 0.5 * vol); n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + 0.3); break; }
    case 'reload': { for (let i = 0; i < 2; i++) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 220 + i * 120; const g = ctx.createGain(); env(g, t + i * 0.25, 0.002, 0.05, 0.15 * vol); o.connect(g); g.connect(out); o.start(t + i * 0.25); o.stop(t + i * 0.25 + 0.08); } break; }
    case 'click': { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 1200; const g = ctx.createGain(); env(g, t, 0.001, 0.03, 0.15 * vol); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.05); break; }
    case 'ui': { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(600, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.08); const g = ctx.createGain(); env(g, t, 0.005, 0.12, 0.2 * vol); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.15); break; }
    case 'step': { const n = ctx.createBufferSource(); n.buffer = noiseBuf(0.2); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500 + Math.random() * 300; const g = ctx.createGain(); env(g, t, 0.003, 0.07, 0.12 * vol); n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + 0.1); break; }
    case 'whoosh': { const n = ctx.createBufferSource(); n.buffer = noiseBuf(0.5); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(1600, t + 0.3); const g = ctx.createGain(); env(g, t, 0.05, 0.3, 0.25 * vol); n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + 0.45); break; }
    case 'flash': { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 3200; const g = ctx.createGain(); env(g, t, 0.01, 2.5, 0.25 * vol); o.connect(g); g.connect(out); o.start(t); o.stop(t + 2.6); break; }
    case 'streak': { [523, 659, 784, 1046].forEach((f, i) => { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; const g = ctx.createGain(); env(g, t + i * 0.08, 0.005, 0.25, 0.2 * vol); o.connect(g); g.connect(out); o.start(t + i * 0.08); o.stop(t + i * 0.08 + 0.3); }); break; }
    case 'beep': { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = opts.freq || 880; const g = ctx.createGain(); env(g, t, 0.005, 0.08, 0.2 * vol); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.1); break; }
    case 'siren': { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(600, t); for (let i = 0; i < 6; i++) { o.frequency.linearRampToValueAtTime(900, t + i * 0.5 + 0.25); o.frequency.linearRampToValueAtTime(600, t + i * 0.5 + 0.5); } const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800; const g = ctx.createGain(); env(g, t, 0.1, 3, 0.12 * vol); o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + 3.2); break; }
    case 'dog': { for (let i = 0; i < 2; i++) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(300, t + i * 0.22); o.frequency.exponentialRampToValueAtTime(150, t + i * 0.22 + 0.12); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; const g = ctx.createGain(); env(g, t + i * 0.22, 0.01, 0.12, 0.2 * vol); o.connect(f); f.connect(g); g.connect(out); o.start(t + i * 0.22); o.stop(t + i * 0.22 + 0.15); } break; }
    case 'heli': { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 22; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300; const g = ctx.createGain(); env(g, t, 0.5, 4, 0.18 * vol); o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + 4.6); break; }
    case 'engine': { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(60, t); o.frequency.linearRampToValueAtTime(140, t + 2); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400; const g = ctx.createGain(); env(g, t, 0.2, 3, 0.2 * vol); o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + 3.3); break; }
    case 'ricochet': { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(2400, t); o.frequency.exponentialRampToValueAtTime(600, t + 0.15); const g = ctx.createGain(); env(g, t, 0.001, 0.15, 0.08 * vol); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.2); break; }
    case 'bass': { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 45; const g = ctx.createGain(); env(g, t, 0.01, 0.5, 0.5 * vol); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.6); break; }
    default: break;
  }
}
