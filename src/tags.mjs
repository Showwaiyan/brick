// The tags on a node box: which ones a node has, and how they are laid out in rows. Pure, no DOM.
import { fullId } from './ids.mjs';

export const TAG = { H: 20, PAD: 8, GAP: 6, CHAR: 7.2, MIN_WRAP: 200, MAX_WRAP: 300 };

const STATE_LABEL = { approved: 'Approved', has_gaps: 'Has gaps', drafting: 'Drafting', superseded: 'Superseded' };
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// The tags of one node, in order: id, state, source, sub-steps, gaps.
export function tagsFor(pd, id) {
  const n = pd.nodes[id];
  const tags = [
    { kind: 'id', text: fullId(pd.project.key, id) },
    { kind: 'state', text: STATE_LABEL[n.state] || n.state, state: n.state },
  ];
  if (n.source === 'ai-draft' && n.state !== 'approved' && n.state !== 'superseded') tags.push({ kind: 'source', text: 'AI draft' });
  if (n.active_children) tags.push({ kind: 'sub', text: `${n.active_children} sub` });
  if (n.open_gaps) tags.push({ kind: 'gap', text: plural(n.open_gaps, 'gap') });
  return tags;
}

// The tags of the root node: the board key, when there is one.
export const rootTags = (pd) => (pd.project.key ? [{ kind: 'key', text: pd.project.key }] : []);

// The width of one tag, from its text (an estimate: no font is measured here).
export const tagWidth = (text) => Math.ceil(String(text).length * TAG.CHAR) + 2 * TAG.PAD;

// Lays the tags out left to right, starting a new row when the next one would pass `wrapWidth`.
export function layoutTags(tags, wrapWidth) {
  const rows = [];
  let row = [];
  let x = 0;
  for (const t of tags) {
    const w = tagWidth(t.text);
    if (row.length && x + w > wrapWidth) { rows.push(row); row = []; x = 0; }
    row.push({ ...t, x, w });
    x += w + TAG.GAP;
  }
  if (row.length) rows.push(row);
  const width = Math.max(0, ...rows.map((r) => r[r.length - 1].x + r[r.length - 1].w));
  return { rows, width };
}

// How wide a row of tags may be, from the title above it.
export const wrapWidthFor = (titleText) => Math.min(TAG.MAX_WRAP, Math.max(TAG.MIN_WRAP, String(titleText).length * TAG.CHAR));
