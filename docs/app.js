// Beat Lab app wiring — browser only (DOM + Web Audio). Engine stays pure.
import { ROWS, STEPS, blankPattern, PRESETS, clampTempo, encodeShare, decodeShare } from './engine.js';
import { playRow, KIT_LABEL } from './synth-kit.js';
import { STEM_STATUS } from './stems.js';

const state = {
  pattern: structuredClone(PRESETS['boom-bap']),
  tempo: 95,
  kit: 'synth', // 'synth' only until a cleared stem pack loads
  playing: false,
  step: 0,
};

let ctx = null, master = null, timer = null, nextTime = 0;

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
      if (state.pattern[r][state.step]) playRow(ctx, master, r, nextTime);
    }
    highlight(state.step, nextTime);
    nextTime += stepDur();
    state.step = (state.step + 1) % STEPS;
  }
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
    label.textContent = r.toUpperCase();
    grid.appendChild(label);
    for (let s = 0; s < STEPS; s++) {
      const c = document.createElement('button');
      c.className = 'cell' + (state.pattern[r][s] ? ' on' : '') + (s % 4 === 0 ? ' beat' : '');
      c.dataset.row = r; c.dataset.step = s;
      c.setAttribute('aria-label', `${r} step ${s + 1}`);
      c.addEventListener('click', () => {
        state.pattern[r][s] = !state.pattern[r][s];
        c.classList.toggle('on');
        if (!state.playing) { audio(); playRow(ctx, master, r, ctx.currentTime); } // audition
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
    timer = setInterval(schedule, 25);
  } else {
    clearInterval(timer); timer = null;
    document.querySelectorAll('.cell.playhead').forEach(c => c.classList.remove('playhead'));
  }
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
  const done = msg => {
    const n = document.getElementById('sharemsg');
    n.textContent = msg;
    setTimeout(() => (n.textContent = ''), 3000);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => done('Link copied — anyone opening it hears YOUR pattern.'), () => done('Link is in the address bar — copy it.'));
  } else done('Link is in the address bar — copy it.');
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
  document.getElementById('stembtn').disabled = true; // gated until clearance lands
  document.getElementById('stembtn').title = 'Artist stems load only after Black clears them — the lab refuses anything uncleared.';
});
