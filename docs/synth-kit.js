// CWI Synth Kit — 100% synthesized drum sounds via Web Audio.
// ZERO audio files. ZERO network requests. No samples = no rights surface.
export const KIT_ID = 'synth';
export const KIT_LABEL = 'CWI Synth Kit — synthesized live in your browser (no samples)';

function noiseBuffer(ctx, seconds) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function env(ctx, dest, time, peak, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + decay);
  g.connect(dest);
  return g;
}

// Schedules one drum hit. Uses only Oscillator/Noise/Gain/Filter nodes.
export function playRow(ctx, dest, row, time) {
  if (row === 'kick') {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, time);
    o.frequency.exponentialRampToValueAtTime(42, time + 0.11);
    const g = env(ctx, dest, time, 0.9, 0.28);
    o.connect(g); o.start(time); o.stop(time + 0.3);
  } else if (row === 'snare') {
    const n = ctx.createBufferSource();
    n.buffer = noiseBuffer(ctx, 0.2);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
    const g = env(ctx, dest, time, 0.55, 0.18);
    n.connect(f); f.connect(g); n.start(time); n.stop(time + 0.2);
    const o = ctx.createOscillator();
    o.type = 'triangle'; o.frequency.value = 190;
    const g2 = env(ctx, dest, time, 0.35, 0.09);
    o.connect(g2); o.start(time); o.stop(time + 0.1);
  } else if (row === 'hat') {
    const n = ctx.createBufferSource();
    n.buffer = noiseBuffer(ctx, 0.06);
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 7500;
    const g = env(ctx, dest, time, 0.28, 0.05);
    n.connect(f); f.connect(g); n.start(time); n.stop(time + 0.06);
  } else if (row === 'perc') {
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(620, time);
    o.frequency.exponentialRampToValueAtTime(880, time + 0.07);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 2400;
    const g = env(ctx, dest, time, 0.3, 0.1);
    o.connect(f); f.connect(g); o.start(time); o.stop(time + 0.12);
  }
}
