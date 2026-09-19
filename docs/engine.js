// Beat Lab engine — pure pattern model + share codec.
// No DOM, no Audio, no network. Runs identically in Node (tests) and browser.
export const ROWS = ['kick', 'snare', 'hat', 'perc'];
export const STEPS = 16;

export function blankPattern() {
  const p = {};
  for (const r of ROWS) p[r] = Array(STEPS).fill(false);
  return p;
}

function bits(s) { // "1010..." (16 chars) -> [bool x16]
  return [...s].map(c => c === '1');
}

export const PRESETS = {
  'empty': blankPattern(),
  'boom-bap': {
    kick:  bits('1000000010000000'),
    snare: bits('0000100000001000'),
    hat:   bits('1010101010101010'),
    perc:  bits('0000001000000010'),
  },
  'trap': {
    kick:  bits('1000001000000010'),
    snare: bits('0000000000001000'),
    hat:   bits('1111111111111111'),
    perc:  bits('0001000000010000'),
  },
  'bounce': {
    kick:  bits('1000100010001000'),
    snare: bits('0000100000001000'),
    hat:   bits('0010001000100010'),
    perc:  bits('1000010010000100'),
  },
};

export function clampTempo(t) {
  const n = Math.round(Number(t));
  if (!Number.isFinite(n)) return 95;
  return Math.min(200, Math.max(60, n));
}

// Share links: URL hash parsed as DATA ONLY — never executed, never eval'd.
export function encodeShare({ pattern, tempo, kit }) {
  const body = {
    v: 1,
    kit: kit === 'stems' ? 'stems' : 'synth',
    tempo: clampTempo(tempo),
    steps: {},
  };
  for (const r of ROWS) body.steps[r] = pattern[r].map(b => (b ? '1' : '0')).join('');
  return btoa(JSON.stringify(body)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeShare(hash) {
  try {
    let s = String(hash == null ? '' : hash).replace(/^#p=/, '').replace(/-/g, '+').replace(/_/g, '/');
    if (!s || s.length > 4096) return null;
    while (s.length % 4) s += '=';
    const obj = JSON.parse(atob(s));
    if (!obj || typeof obj !== 'object' || obj.v !== 1) return null;
    const pattern = blankPattern();
    for (const r of ROWS) {
      const b = obj.steps && obj.steps[r];
      if (typeof b !== 'string' || b.length !== STEPS || /[^01]/.test(b)) return null;
      pattern[r] = bits(b);
    }
    return { pattern, tempo: clampTempo(obj.tempo), kit: obj.kit === 'stems' ? 'stems' : 'synth' };
  } catch {
    return null; // malformed input is a null, never an exception, never code
  }
}
