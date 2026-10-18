// The rules. Each function changes `data` in place or throws an Error saying why not.
// Callers run these inside store.mutate(), so a throw means nothing is saved.
import { activeChildren, children, isLeaf, openGaps } from './model.mjs';
import { addEvent, newGapId, TOOL_NAME, PLUGIN_NAME } from './store.mjs';

const T = TOOL_NAME;
const S = `/${PLUGIN_NAME}:`; // slash commands are what the human types

// True for null, undefined, or whitespace-only text.
export const blank = (s) => s === null || s === undefined || String(s).trim() === '';

// Returns a node or throws a helpful error.
export function needNode(data, id) {
  const n = data.nodes[id];
  if (!n) throw new Error(`There is no node "${id}". Run: ${T} ls`);
  return n;
}

// Returns the reason a node cannot be approved, or null if it can.
export function approveCheck(data, id) {
  const n = needNode(data, id);
  if (n.status !== 'drafting') return `${id} is ${n.status}, not drafting.`;
  if (blank(n.title)) return `${id} has no title.`;
  const gaps = openGaps(data, id);
  if (gaps.length) {
    return `${id} has open gaps. Resolve or dismiss them first:\n` + gaps.map((g) => `  ${g.id}: ${g.missing}`).join('\n');
  }
  const open = activeChildren(data, id).filter((c) => c.status !== 'approved');
  if (open.length) return `${id} has children that are not approved yet: ${open.map((c) => c.id).join(', ')}.`;
  if (isLeaf(data, id)) {
    const missing = ['input', 'output', 'check'].filter((k) => blank(n.contract[k]));
    if (missing.length) return `${id} is a leaf, so its contract needs: ${missing.join(', ')}. Tell Claude the ${missing[0]} for ${id}, so it can record it.`;
  }
  return null;
}

// Human approves a node.
export function approve(data, id, now) {
  const why = approveCheck(data, id);
  if (why) throw new Error(why);
  const n = data.nodes[id];
  n.status = 'approved';
  n.updated_at = now;
  addEvent(data, 'human', 'approve', id, {}, now);
  return `approved ${id}`;
}

// Human sends an approved node back to drafting. A reason is required.
export function reopen(data, id, why, now) {
  const n = needNode(data, id);
  if (n.status !== 'approved') throw new Error(`${id} is ${n.status}; only an approved node can be reopened.`);
  if (blank(why)) throw new Error(`--why is required. Say why ${id} is being reopened.`);
  n.status = 'drafting';
  n.updated_at = now;
  addEvent(data, 'human', 'reopen', id, { why }, now);
  return `reopened ${id}`;
}

// A node's active (not yet superseded) descendants, depth first.
function activeDescendants(data, id) {
  return activeChildren(data, id).flatMap((c) => [c.id, ...activeDescendants(data, c.id)]);
}

// Human marks a node and everything below it as superseded. Nothing is deleted.
export function supersede(data, id, why, by, now) {
  const n = needNode(data, id);
  if (n.status === 'superseded') throw new Error(`${id} is already superseded.`);
  if (blank(why)) throw new Error(`--why is required. Say why ${id} is being dropped.`);
  if (by) {
    const b = needNode(data, by);
    if (by === id) throw new Error('--by cannot be the node itself.');
    if (b.status === 'superseded') throw new Error(`--by ${by} is superseded.`);
    if (b.kind !== n.kind) throw new Error(`--by ${by} is a ${b.kind}, but ${id} is a ${n.kind}.`);
  }
  const affected = [id, ...activeDescendants(data, id)];
  for (const a of affected) {
    const node = data.nodes[a];
    node.status = 'superseded';
    node.updated_at = now;
    node.superseded = a === id
      ? { reason: why, by: by || null, cascade_from: null, at: now }
      : { reason: `parent ${id} superseded`, by: null, cascade_from: id, at: now };
    addEvent(data, 'human', 'supersede', a, a === id ? { why, by: by || null } : { cascade_from: id }, now);
    for (const g of openGaps(data, a)) closeGap(data, g.id, 'dismissed', 'node superseded', now);
  }
  const parent = n.parent && data.nodes[n.parent];
  if (parent && parent.status === 'approved') {
    parent.status = 'drafting';
    parent.updated_at = now;
    addEvent(data, 'human', 'reopen', parent.id, { why: `child ${id} superseded` }, now);
  }
  return `superseded ${affected.join(', ')}\nNothing built from these has been undone. This command only changes the record.`;
}

// Human undoes a direct supersede. Restored nodes go back to drafting, never approved.
export function restore(data, id, now) {
  const n = needNode(data, id);
  if (n.status !== 'superseded') throw new Error(`${id} is not superseded.`);
  if (n.superseded.cascade_from !== null) {
    throw new Error(`${id} was superseded along with ${n.superseded.cascade_from}. Restore that one instead: ${S}restore ${n.superseded.cascade_from}`);
  }
  if (n.parent && data.nodes[n.parent].status === 'superseded') {
    throw new Error(`${id}'s parent ${n.parent} is superseded. Restore the parent first.`);
  }
  const back = [id, ...Object.values(data.nodes).filter((x) => x.superseded && x.superseded.cascade_from === id).map((x) => x.id)];
  for (const b of back) {
    data.nodes[b].status = 'drafting';
    data.nodes[b].superseded = null;
    data.nodes[b].updated_at = now;
  }
  addEvent(data, 'human', 'restore', id, { restored: back }, now);
  return `restored ${back.join(', ')} (as drafting)`;
}

// Records a gap on a node. No gate or lint yet; the `ai gap` command adds those.
export function raiseGap(data, actor, nodeId, missing, where, now, kind = null, seen = null) {
  needNode(data, nodeId);
  const id = newGapId(data, nodeId);
  data.gaps[id] = { id, node: nodeId, missing, where: where || null, status: 'open', raised_at: now, closed_at: null, note: null, ...(kind ? { kind } : {}), ...(seen ? { seen } : {}) };
  addEvent(data, actor, 'gap', id, { node: nodeId }, now);
  return id;
}

// The kinds of gap the AI can name. Optional; a gap without one shows none.
export const GAP_KINDS = ['edge-case', 'architecture', 'assumption', 'order', 'other'];

// Phrases that suggest a fix instead of naming what is missing (a speed bump, not a guarantee).
const FIX_PATTERNS = [
  /you should/i, /should (use|add|implement|create|make)/i, /consider (using|adding|implementing)/i,
  /\btry\b/i, /\buse (a|an|the)\b/i, /\badd (a|an|the)\b/i, /implement (a|an|the)/i,
  /\bthe fix\b/i, /\bsolution\b/i, /instead,? (use|do)/i, /\bI (suggest|recommend)\b/i,
];

// Throws unless the gap text names what is missing, in one line of 8 to 300 characters.
export function lintMissing(text) {
  const t = (text || '').trim();
  if (t.length < 8 || t.length > 300) throw new Error('--missing must be 8 to 300 characters.');
  if (/[\r\n]/.test(t)) throw new Error('--missing must be a single line.');
  if (FIX_PATTERNS.some((re) => re.test(t))) {
    throw new Error('State what is missing, not how to fill it. Examples: "Nothing defines X." / "It is unclear what happens when Y." / "X assumes Z, which nothing provides."');
  }
  return t;
}

// Quotes that only point at something the AI said ("option 2", "yes", "that one"). A speed bump, not a guarantee.
const ORD = '(?:first|second|third|fourth|last|other|former|latter)';
const POINTER_PATTERNS = [
  /^(?:yes|yeah|yep|yup|ok|okay|sure|agreed|agree|fine|right|correct|exactly|good|great|perfect|sounds good|that works|do it|do it your way|go ahead|please do|why not)(?: please| thanks| thank you)?$/,
  /^(?:option|number|choice|opt|#)\s*(?:\d+|[a-z]|one|two|three|four|five)$/,
  /^(?:\d+|[a-d])$/,
  new RegExp(`^(?:the )?${ORD}(?: one| option| choice)?$`),
  /^(?:that|this|the same)(?: one)?$/,
  new RegExp(`^(?:(?:let s |lets |i ll |i will |we ll |we will |i d |i would |we can |can we |ok |okay )*)(?:go|going|stick|pick|choose|take|use) (?:with )?(?:it|that|this|them|those|the same|your \\w+(?: \\w+)?|(?:option|number|choice|#)\\s*\\w+|(?:the )?${ORD}(?: one| option| choice)?)$`),
  /^(?:your|ur) (?:idea|suggestion|proposal|recommendation|approach|way|option)(?: then| is fine| works)?$/,
  /^(?:as|like) you (?:said|suggested|mentioned|proposed|recommended)$/,
];

// Throws when the quote only points at what the AI said; returns the trimmed quote otherwise.
export function lintSaid(text) {
  const q = String(text || '').trim();
  const plain = q.toLowerCase().replace(/[^\p{L}\p{N}#]+/gu, ' ').trim();
  if (!plain || POINTER_PATTERNS.some((re) => re.test(plain))) {
    throw new Error('That only points at something Claude said. Ask the user to say it in their own words (what they chose, and why if they can), then record that.');
  }
  return q;
}

// The AI raises a gap. The user must have written something for the node first.
export function raiseGapChecked(data, nodeId, missing, where, now, kind = null, seen = null) {
  const n = needNode(data, nodeId);
  if (seen && !data.seen?.[seen]) throw new Error(`There is no note "${seen}". Record it first with ai seen.`);
  const named = Object.values(data.seen || {}).find((x) => !seen && x.path && String(missing || '').includes(x.path));
  if (named) throw new Error(`This gap names ${named.path}, which is note ${named.id}. Add --seen ${named.id} so the page shows what it is because of, then run it again.`);
  if (kind && !GAP_KINDS.includes(kind)) throw new Error(`--kind must be one of: ${GAP_KINDS.join(', ')}.`);
  if (n.status === 'superseded') throw new Error(`${nodeId} is superseded; gaps cannot be raised on it.`);
  if (n.source !== 'human' && n.said.length === 0) {
    throw new Error('This node has no content from the user yet. Ask the user for their own attempt first.');
  }
  return raiseGap(data, 'ai', nodeId, lintMissing(missing), where, now, kind, seen);
}

// Closes an open gap as resolved or dismissed. A note is required.
export function closeGap(data, gapId, status, note, now) {
  const g = data.gaps[gapId];
  if (!g) throw new Error(`There is no gap "${gapId}".`);
  if (g.status !== 'open') throw new Error(`${gapId} is already ${g.status}.`);
  if (blank(note)) throw new Error(`${status === 'resolved' ? '--note' : '--why'} is required.`);
  g.status = status;
  g.note = note;
  g.closed_at = now;
  addEvent(data, 'human', status === 'resolved' ? 'gap-resolve' : 'gap-dismiss', gapId, { node: g.node, note }, now);
  return `${status} ${gapId}`;
}

// Next order number among siblings, counting superseded ones.
export function nextOrder(data, parent) {
  const sibs = children(data, parent);
  return sibs.length ? Math.max(...sibs.map((s) => s.order)) + 1 : 1;
}
