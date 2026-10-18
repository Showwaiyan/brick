// Ids and board keys. Pure functions, no imports.
// A stored id is short: b1, p3, p3.1, p3.1.2, or a gap p3.1.g2 (legacy gaps are flat: g2).
// The full id adds the board key in front: LOGIN-p3.1.2.

export const KEY_RE = /^[A-Z][A-Z0-9]{1,5}$/;

const STOP = new Set(['the', 'and', 'for', 'want', 'build', 'make', 'create', 'new', 'add', 'how', 'what', 'with', 'our', 'my', 'to']);
const FALLBACK_KEY = 'BOARD';
const MAX_KEY = 6;
const ID = /^(?:([A-Za-z][A-Za-z0-9]{1,5})-)?([bp]\d+(?:\.\d+)*(?:\.g\d+)?|g\d+)$/i;

// A key from the board's name, avoiding the keys in `taken`.
export function deriveKey(name, taken = []) {
  const used = new Set(taken.map((k) => k.toUpperCase()));
  const clean = (w) => w.toUpperCase().replace(/^\d+/, '').slice(0, MAX_KEY);
  const words = String(name || '').split(/[^A-Za-z0-9]+/).filter(Boolean);
  let base = null;
  for (const w of words) {
    if (w.length < 3 || STOP.has(w.toLowerCase())) continue;
    const k = clean(w);
    if (k.length >= 2) { base = k; break; }
  }
  if (!base) {
    const k = clean(words.join(''));
    base = k.length >= 2 ? k : FALLBACK_KEY;
  }
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = String(n);
    const candidate = base.slice(0, MAX_KEY - suffix.length) + suffix;
    if (!used.has(candidate)) return candidate;
  }
}

// The id with the board key in front (or as it is when there is no key).
export const fullId = (key, id) => (key ? `${key}-${id}` : id);

// The full id of a stored id, using the key of the board in `data`.
export const fid = (data, id) => fullId(data?.project?.key, id);

// Reads a full or short id. Returns { key, short } (key upper-case or null), or null if it is not an id.
export function parseId(text) {
  const m = String(text).trim().match(ID);
  return m ? { key: m[1] ? m[1].toUpperCase() : null, short: m[2].toLowerCase() } : null;
}

// The id one level up: p3.1.2 -> p3.1, p3.1.g2 -> p3.1. Flat ids have none.
export function parentOf(id) {
  const i = id.lastIndexOf('.');
  return i === -1 ? null : id.slice(0, i);
}

// Sort order for ids, by segment: p3.2 before p3.10, a parent before its children.
export function compareIds(a, b) {
  const seg = (s) => s.split('.').map((x) => { const m = x.match(/^([a-z]*)(\d+)$/i); return m ? [m[1].toLowerCase(), Number(m[2])] : [x, 0]; });
  const sa = seg(a);
  const sb = seg(b);
  for (let i = 0; i < Math.min(sa.length, sb.length); i++) {
    if (sa[i][0] !== sb[i][0]) return sa[i][0] < sb[i][0] ? -1 : 1;
    if (sa[i][1] !== sb[i][1]) return sa[i][1] - sb[i][1];
  }
  return sa.length - sb.length;
}

// Adds the key to every bare id in a result line (the lines our own code writes; never user text).
export function decorateIds(text, key) {
  if (!key) return text;
  return String(text).replace(/(?<![\w.-])([bp]\d+(?:\.\d+)*(?:\.g\d+)?|g\d+)(?![\w-])/g, `${key}-$1`);
}
