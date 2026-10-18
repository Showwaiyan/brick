// Signals for `board check`: the part of "is this broken down enough?" that code can know.
// Facts and flags, never a verdict: the words "ready" and "complete" are not used here.
import { children, activeChildren, openGaps, displayState } from './model.mjs';

// Guides, not rules. All the limits live here.
export const LIMITS = { topMin: 3, topMax: 9, depthMax: 4, siblingsMax: 9 };

const CONTRACT = ['input', 'output', 'check'];
const JOINS = /\s(?:and|&|\+)\s/i;
const LABEL = { approved: 'approved', drafting: 'drafting', has_gaps: 'has gaps', superseded: 'superseded' };
const sig = (key, flag, text) => ({ key, flag, text });

// How many levels down a node is (a top-level box is 1).
function depthOf(data, id) {
  let d = 1;
  for (let n = data.nodes[id]; n.parent; n = data.nodes[n.parent]) d += 1;
  return d;
}

// The contract fields that are not set.
const missingFields = (n) => CONTRACT.filter((k) => !n.contract[k]);

// Describes what is set in a contract.
function contractText(n) {
  const missing = missingFields(n);
  if (!missing.length) return 'input, output, check set';
  const set = CONTRACT.filter((k) => !missing.includes(k));
  return `${missing.join(', ')} not set${set.length ? ` (${set.join(', ')} set)` : ''}`;
}

const isDraft = (n) => n.source === 'ai-draft' && n.status !== 'approved' && n.status !== 'superseded';

// Signals for one node.
export function nodeSignals(data, id) {
  const n = data.nodes[id];
  if (n.status === 'superseded') return [sig('superseded', false, 'superseded, nothing to check')];
  const kids = activeChildren(data, id);
  const out = [];
  out.push(kids.length
    ? sig('contract', false, 'not required here, it has sub-problems')
    : sig('contract', missingFields(n).length > 0, contractText(n)));
  out.push(sig('purpose', JOINS.test(n.title), JOINS.test(n.title) ? 'title joins two things' : 'title names one thing'));
  out.push(sig('children', false, kids.length
    ? `${kids.length} active (${kids.map((c) => `${c.id} ${LABEL[displayState(data, c.id)]}`).join(', ')})`
    : 'none'));
  const sibs = activeChildren(data, n.parent).length;
  out.push(sig('siblings', sibs > LIMITS.siblingsMax, `${sibs} at this level (guide: up to ${LIMITS.siblingsMax})`));
  const depth = depthOf(data, id);
  out.push(sig('depth', depth > LIMITS.depthMax, `${depth} (guide: up to ${LIMITS.depthMax})`));
  const gaps = openGaps(data, id);
  out.push(sig('gaps', gaps.length > 0, gaps.length ? `${gaps.length} (${gaps.map((g) => g.id).join(', ')})` : 'none'));
  if (isDraft(n)) out.push(sig('draft', true, 'AI draft, not approved yet'));
  return out;
}

// Signals for the whole board.
export function boardSignals(data) {
  const live = Object.values(data.nodes).filter((n) => n.status !== 'superseded');
  const top = activeChildren(data, null).length;
  const list = (ids) => (ids.length ? ids.join(', ') : 'none');
  const leaves = live.filter((n) => !activeChildren(data, n.id).length && missingFields(n).length);
  const gapped = live.filter((n) => openGaps(data, n.id).length);
  const joined = live.filter((n) => JOINS.test(n.title));
  const drafts = live.filter(isDraft);
  const deepest = Math.max(0, ...live.map((n) => depthOf(data, n.id)));
  return [
    sig('top', top < LIMITS.topMin || top > LIMITS.topMax, `${top} box${top === 1 ? '' : 'es'} at the top level (guide: ${LIMITS.topMin} to ${LIMITS.topMax})`),
    sig('depth', deepest > LIMITS.depthMax, `${deepest} (guide: up to ${LIMITS.depthMax})`),
    sig('contracts', leaves.length > 0, `pieces with no sub-problems and an incomplete contract: ${list(leaves.map((n) => n.id))}`),
    sig('purpose', joined.length > 0, `titles that join two things: ${list(joined.map((n) => n.id))}`),
    sig('gaps', gapped.length > 0, `nodes with open gaps: ${list(gapped.map((n) => `${n.id} (${openGaps(data, n.id).length})`))}`),
    sig('drafts', drafts.length > 0, `AI drafts not approved yet: ${list(drafts.map((n) => n.id))}`),
  ];
}

// The text `board check` prints.
export function checkText(data, id) {
  let head;
  let list;
  if (id) {
    const n = data.nodes[id];
    if (!n) throw new Error(`There is no node "${id}". Run: board ls`);
    head = `${n.id}  ${n.title}  (${n.kind})`;
    list = nodeSignals(data, id);
  } else {
    head = `Board: ${data.project.name}`;
    list = boardSignals(data);
  }
  const names = { contract: 'contract', purpose: 'purpose', children: 'sub-problems', siblings: 'siblings', depth: 'depth', gaps: 'open gaps', draft: 'provenance', top: 'top level', contracts: 'contracts', drafts: 'AI drafts', superseded: 'state' };
  const lines = list.map((s) => `  ${s.flag ? 'flag' : 'ok  '}  ${names[s.key] || s.key}: ${s.text}`);
  return [head, ...lines, 'These are signals for you to weigh, not a verdict.'].join('\n');
}
