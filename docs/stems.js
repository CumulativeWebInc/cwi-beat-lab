// Artist stem module — CLEARANCE-GATED drop-in.
// Hard rule: loads NOTHING unless every stem carries explicit clearance.
// The UI must never imply artist sounds are included before clearance.
export const STEM_STATUS = {
  cleared: false,          // default honest state: not cleared
  loaded: false,
  label: 'Artist stem pack — pending clearance',
};

// Throws on ANY missing clearance field. One bad stem refuses the whole module.
export function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.stems)) {
    throw new Error('stems: manifest must be an object with a stems array — refusing to load');
  }
  if (manifest.stems.length === 0) {
    throw new Error('stems: empty stem list — refusing to load');
  }
  for (const s of manifest.stems) {
    const id = (s && s.id) || '?';
    for (const f of ['id', 'url', 'clearedBy', 'clearedAt', 'license']) {
      if (!s || typeof s[f] !== 'string' || !s[f].trim()) {
        throw new Error(`stems: stem "${id}" missing clearance field "${f}" — refusing entire module`);
      }
    }
    if (!/^https:\/\//.test(s.url)) {
      throw new Error(`stems: stem "${id}" url must be https — refusing entire module`);
    }
  }
  return true;
}

// Only called with a validated manifest. Never called with uncleared data.
export async function loadStems(manifest, audioCtx) {
  validateManifest(manifest); // throws -> nothing loads, nothing plays
  const sounds = {};
  for (const s of manifest.stems) {
    const res = await fetch(s.url);
    if (!res.ok) throw new Error(`stems: failed to fetch "${s.id}" — aborting load`);
    const buf = await res.arrayBuffer();
    sounds[s.id] = await audioCtx.decodeAudioData(buf);
  }
  STEM_STATUS.cleared = true;
  STEM_STATUS.loaded = true;
  STEM_STATUS.label = `Artist stem pack — cleared by ${manifest.stems[0].clearedBy} (${manifest.stems[0].clearedAt})`;
  return { id: 'stems', label: STEM_STATUS.label, sounds };
}

// User-initiated entry point: fetches the manifest, then loadStems.
// The ONLY network touch in the stem path, and only after an explicit tap.
export async function loadStemPack(manifestUrl, audioCtx) {
  const res = await fetch(manifestUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error('stems: manifest fetch failed — refusing to load');
  return loadStems(await res.json(), audioCtx);
}
