// Beat Lab app wiring — browser only (DOM + Web Audio). Engine stays pure.
import { ROWS, STEPS, blankPattern, PRESETS, clampTempo, encodeShare, decodeShare } from './engine.js';
import { playRow, KIT_LABEL } from './synth-kit.js';
import { STEM_STATUS, loadStemPack } from './stems.js';

// In stem-pack mode the 4 sequencer rows drive the 4 cleared stems:
// each row's 16 steps gate its stem loop (on = stem audible that step).
const STEM_ROW_MAP = { kick: 'drums', snare: 'bass', hat: 'vocals', perc: 'other' };

const state = {
  pattern: structuredClone(PRESETS['boom-bap']),
  tempo: 95,
  kit: 'synth', // 'synth' | 'stems'
  stems: null,  // { id, label, sounds } once a cleared pack loads
  playing: false,
  step: 0,
};

let ctx = null, master = null, timer = null, nextTime = 0;
let stemNodes = null; // {row: {src, gain}} — live only while stem kit is playing

const rowDisplay = r => state.kit === 'stems' ? STEM_ROW_MAP[r].toUpperCase() : r.toUpperCase();

function soundStatus() {
  const el = document.getElementById('soundstatus');
  if (!el) return;
  if (!ctx) { el.textContent = '🔇 sound: tap PLAY'; el.classList.remove('on'); return; }
  if (ctx.state === 'running') { el.textContent = '🔊 sound on'; el.classList.add('on'); }
  else { el.textContent = '🔇 sound blocked — tap PLAY, check silent switch & volume'; el.classList.remove('on'); }
}

function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
    ctx.onstatechange = soundStatus;
  }
  if (ctx.state === 'suspended') ctx.resume().then(soundStatus).catch(soundStatus);
  soundStatus();
  return ctx;
}

const stepDur = () => 60 / state.tempo / 4;

function schedule() {
  const ahead = 0.12;
  while (nextTime < ctx.currentTime + ahead) {
    for (const r of ROWS) {
      if (state.kit === 'stems') {
        // gate the stem loop: audible on patterned steps, muted elsewhere
        const n = stemNodes && stemNodes[r];
        if (n) n.gain.gain.setTargetAtTime(state.pattern[r][state.step] ? 1.0 : 0.0, nextTime, 0.015);
      } else if (state.pattern[r][state.step]) {
        playRow(ctx, master, r, nextTime);
      }
    }
    highlight(state.step, nextTime);
    nextTime += stepDur();
    state.step = (state.step + 1) % STEPS;
  }
}

function startStemLoops() {
  stopStemLoops();
  stemNodes = {};
  const t = ctx.currentTime + 0.06;
  for (const r of ROWS) {
    const id = STEM_ROW_MAP[r];
    const buf = state.stems.sounds[id];
    if (!buf) continue;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0.0;
    src.connect(g); g.connect(master);
    src.start(t);
    stemNodes[r] = { src, gain: g };
  }
}

function stopStemLoops() {
  if (!stemNodes) return;
  for (const r of Object.keys(stemNodes)) {
    try { stemNodes[r].src.stop(); } catch {}
    try { stemNodes[r].src.disconnect(); stemNodes[r].gain.disconnect(); } catch {}
  }
  stemNodes = null;
}

function auditionStem(r) {
  // not playing: play this stem's loop solo briefly so taps still audition
  const id = STEM_ROW_MAP[r];
  const buf = state.stems && state.stems.sounds[id];
  if (!buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  const g = ctx.createGain();
  g.gain.value = 1.0;
  src.connect(g); g.connect(master);
  src.start();
  g.gain.setTargetAtTime(0.0, ctx.currentTime + 0.9, 0.2);
  src.stop(ctx.currentTime + 1.5);
}

function highlight(step, when) {
  const delay = Math.max(0, (when - ctx.currentTime) * 1000);
  setTimeout(() => {
    document.querySelectorAll('.cell.playhead').forEach(c => c.classList.remove('playhead'));
    document.querySelectorAll(`.cell[data-step="${step}"]`).forEach(c => c.classList.add('playhead'));
  }, delay);
}

function buildGrid() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  for (const r of ROWS) {
    const label = document.createElement('div');
    label.className = 'rowlabel';
    label.textContent = rowDisplay(r);
    grid.appendChild(label);
    for (let s = 0; s < STEPS; s++) {
      const c = document.createElement('button');
      c.className = 'cell' + (state.pattern[r][s] ? ' on' : '') + (s % 4 === 0 ? ' beat' : '');
      c.dataset.row = r; c.dataset.step = s;
      c.setAttribute('aria-label', `${r} step ${s + 1}`);
      c.addEventListener('click', () => {
        state.pattern[r][s] = !state.pattern[r][s];
        c.classList.toggle('on');
        if (!state.playing) {
          audio();
          if (state.kit === 'stems') auditionStem(r); else playRow(ctx, master, r, ctx.currentTime);
        }
      });
      grid.appendChild(c);
    }
  }
}

function refreshGrid() { buildGrid(); }

function setPlaying(p) {
  state.playing = p;
  document.getElementById('playbtn').textContent = p ? '⏹ STOP' : '▶ PLAY';
  if (p) {
    audio();
    state.step = 0;
    nextTime = ctx.currentTime + 0.06;
    if (state.kit === 'stems') startStemLoops();
    timer = setInterval(schedule, 25);
  } else {
    clearInterval(timer); timer = null;
    stopStemLoops();
    document.querySelectorAll('.cell.playhead').forEach(c => c.classList.remove('playhead'));
  }
}

async function onLoadStemPack() {
  const btn = document.getElementById('stembtn');
  const msg = document.getElementById('sharemsg');
  try {
    btn.disabled = true;
    msg.textContent = 'Loading cleared stem pack…';
    audio();
    const pack = await loadStemPack('stems/stems.json', ctx); // throws on ANY missing clearance field
    if (state.playing) setPlaying(false);
    state.stems = pack;
    state.kit = 'stems';
    document.getElementById('kitlabel').textContent = pack.label + ' — Broken Hearts Club (DSP-separated stems)';
    document.getElementById('stemstatus').textContent = STEM_STATUS.label;
    btn.textContent = '✓ STEMS LIVE';
    refreshGrid();
    msg.textContent = 'Broken Hearts Club stems live — rows are now DRUMS / BASS / VOCALS / OTHER.';
  } catch (e) {
    msg.textContent = 'Stem pack refused: ' + e.message;
    btn.disabled = false;
  }
  setTimeout(() => { if (msg.textContent.startsWith('Broken Hearts') || msg.textContent.startsWith('Loading')) msg.textContent = ''; }, 5000);
}

function applyShared() {
  const d = decodeShare(location.hash);
  if (!d) return false;
  state.pattern = d.pattern;
  state.tempo = d.tempo;
  document.getElementById('tempo').value = d.tempo;
  document.getElementById('tempoval').textContent = d.tempo + ' BPM';
  refreshGrid();
  return true;
}

function share() {
  const hash = '#p=' + encodeShare({ pattern: state.pattern, tempo: state.tempo, kit: state.kit });
  const url = location.origin + location.pathname + hash;
  history.replaceState(null, '', hash);
  const n = document.getElementById('sharemsg');
  const done = msg => { n.textContent = msg; };
  // iOS-friendly order: native share sheet first (viral), then clipboard, then manual select.
  if (navigator.share) {
    navigator.share({ title: 'My CWI Beat Lab pattern', url }).then(
      () => done('Shared — anyone opening it hears YOUR pattern.'),
      () => done('Share cancelled — link is in the address bar.'));
    return;
  }
  const legacyCopy = () => {
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try {
      const ok = document.execCommand('copy');
      done(ok ? 'Link copied — anyone opening it hears YOUR pattern.' : 'Copy failed — link is in the address bar.');
    } catch { done('Link is in the address bar — copy it.'); }
    document.body.removeChild(ta);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(
      () => done('Link copied — anyone opening it hears YOUR pattern.'),
      legacyCopy);
  } else legacyCopy();
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('kitlabel').textContent = KIT_LABEL;
  document.getElementById('stemstatus').textContent = STEM_STATUS.label;
  buildGrid();
  const had = applyShared();
  if (had) {
    const n = document.getElementById('sharemsg');
    n.textContent = 'Loaded a shared pattern — press PLAY.';
    setTimeout(() => (n.textContent = ''), 4000);
  }
  document.getElementById('playbtn').addEventListener('click', () => setPlaying(!state.playing));
  document.getElementById('clearbtn').addEventListener('click', () => { state.pattern = blankPattern(); refreshGrid(); });
  document.getElementById('sharebtn').addEventListener('click', share);
  document.getElementById('tempo').addEventListener('input', e => {
    state.tempo = clampTempo(e.target.value);
    document.getElementById('tempoval').textContent = state.tempo + ' BPM';
  });
  document.getElementById('preset').addEventListener('change', e => {
    const p = PRESETS[e.target.value];
    if (p) { state.pattern = structuredClone(p); refreshGrid(); }
  });
  const sb = document.getElementById('stembtn');
  sb.disabled = false;
  sb.textContent = 'LOAD BHC STEMS';
  sb.title = 'Load the cleared Broken Hearts Club stem pack (drums / bass / vocals / other).';
  sb.addEventListener('click', onLoadStemPack);
});
