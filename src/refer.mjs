// Reads a human's plain-words request ("approve check password", "dismiss g1 not real")
// and works out what it points at. Fixed rules only: no AI, no shell. Never guesses.
import { PLUGIN_NAME } from './store.mjs';
import { fid } from './ids.mjs';

const S = `/${PLUGIN_NAME}:`;
const NODE_ID = /^["'“‘]?([bp]\d+(?:\.\d+)*)(?![\w])/i;
const NODE_ID_ANYWHERE = /(?:^|\s)([bp]\d+(?:\.\d+)*)(?=[\s.,;:!?)"'”’]|$)/i;
const GAP_ID = /^["'“‘]?((?:[bp]\d+(?:\.\d+)*\.)?g\d+)(?![\w])/i;
const GAP_ID_ANYWHERE = /(?:^|\s)((?:[bp]\d+(?:\.\d+)*\.)?g\d+)(?=[\s.,;:!?)"'”’]|$)/i;

// What each verb needs. `reason` is how the missing piece is named; `ing` is the verb as used in "a reason for ...".
const VERBS = {
  approve: { kind: 'node', want: (n) => n.status === 'drafting' },
  restore: { kind: 'node', want: (n) => n.status === 'superseded' && n.superseded.cascade_from === null },
  reopen: { kind: 'node', want: (n) => n.status === 'approved', reason: 'a reason', ing: 'reopening' },
  supersede: { kind: 'node', want: (n) => n.status !== 'superseded', reason: 'a reason', ing: 'superseding', by: true },
  resolve: { kind: 'gap', reason: 'a note', ing: 'resolving' },
  dismiss: { kind: 'gap', reason: 'a reason', ing: 'dismissing' },
};

// Removes "because", "since", "why" and leading punctuation from a reason.
function cleanReason(text) {
  return String(text).replace(/^(?:\s|(?:because|since|why)\b|[:;,]|[-–—](?=\s))+/i, '').trim();
}

// Drops opening quotes and spaces.
const trimLead = (t) => String(t).replace(/^["'“‘\s]+/, '');

// Finds nodes whose title starts the text (case-insensitive, a leading "the"/"node" ignored).
// Returns { nodes, rest } for the longest match, or null.
function titlePrefix(text, nodes) {
  const t = trimLead(text);
  let best = null;
  for (const n of nodes) {
    const pattern = n.title.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    if (!pattern) continue;
    const m = t.match(new RegExp(`^(?:(?:the|node)\\s+)*${pattern}(?![\\p{L}\\p{N}])`, 'iu'));
    if (!m) continue;
    if (!best || m[0].length > best.len) best = { len: m[0].length, nodes: [n] };
    else if (m[0].length === best.len) best.nodes.push(n);
  }
  return best ? { nodes: best.nodes, rest: t.slice(best.len) } : null;
}

// Builds a NEEDS message. Nothing has been changed when this is returned.
function needs(headline, lines = [], command = '') {
  return { needs: ['NEEDS: ' + headline, ...lines, 'Nothing was changed.', ...(command ? [`Complete command: ${command}`] : [])].join('\n') };
}

// Finds the node a request points at. Returns { id, rest } or { needs }.
function findNode(data, verb, text) {
  const t = trimLead(text);
  const all = Object.values(data.nodes);
  const m = t.match(NODE_ID);
  if (m) {
    const id = m[1].toLowerCase();
    return data.nodes[id] ? { id, rest: t.slice(m[0].length) } : needs(`which node? There is no node "${id}".`);
  }
  const candidates = all.filter(VERBS[verb].want);
  const hit = titlePrefix(t, candidates);
  if (hit && hit.nodes.length === 1) return { id: hit.nodes[0].id, rest: hit.rest };
  if (hit) {
    const ids = hit.nodes.map((n) => fid(data, n.id));
    return needs(`which one? Several nodes are titled "${hit.nodes[0].title}": ${ids.join(', ')}.`, [], `${S}${verb} ${ids[0]}`);
  }
  const any = t.match(NODE_ID_ANYWHERE);
  if (any && data.nodes[any[1].toLowerCase()]) {
    return { id: any[1].toLowerCase(), rest: `${t.slice(0, any.index)} ${t.slice(any.index + any[0].length)}` };
  }
  const list = candidates.slice(0, 12).map((n) => `${fid(data, n.id)} ${n.title}`).join(', ');
  return needs(`which node?${t ? ` I could not match "${t}".` : ''}`, [list ? `Nodes you could use: ${list}` : 'There are no nodes this applies to.'], `${S}${verb} <node id or title>`);
}

// Finds the gap a request points at: a g-id, or a node title with exactly one open gap.
function findGap(data, verb, text) {
  const t = trimLead(text);
  const open = Object.values(data.gaps).filter((g) => g.status === 'open');
  const describe = (g) => `${fid(data, g.id)} (on ${fid(data, g.node)}): ${g.missing}`;
  const lead = t.match(GAP_ID);
  if (lead) {
    const id = lead[1].toLowerCase();
    return data.gaps[id] ? { id, rest: t.slice(lead[0].length) } : needs(`which gap? There is no gap "${id}".`);
  }
  const hit = titlePrefix(t, Object.values(data.nodes).filter((n) => n.status !== 'superseded'));
  if (hit && hit.nodes.length === 1) {
    const mine = open.filter((g) => g.node === hit.nodes[0].id);
    if (mine.length === 1) return { id: mine[0].id, rest: hit.rest };
    if (mine.length > 1) return needs(`which gap? ${hit.nodes[0].title} has ${mine.length} open gaps.`, mine.map(describe), `${S}${verb} ${fid(data, mine[0].id)} <your reason>`);
    return needs(`which gap? ${hit.nodes[0].title} has no open gaps.`);
  }
  const any = t.match(GAP_ID_ANYWHERE);
  if (any && data.gaps[any[1].toLowerCase()]) {
    return { id: any[1].toLowerCase(), rest: `${t.slice(0, any.index)} ${t.slice(any.index + any[0].length)}` };
  }
  const lines = open.slice(0, 12).map(describe);
  return needs(`which gap?${t ? ` I could not match "${t}".` : ''}`, lines.length ? lines : ['There are no open gaps.'], `${S}${verb} <gap id> <your reason>`);
}

// Turns a typed request into engine arguments: { argv } or { needs }.
export function parseRequest(data, verb, text) {
  const v = VERBS[verb];
  const found = v.kind === 'gap' ? findGap(data, verb, text) : findNode(data, verb, text);
  if (found.needs) return found;
  const { id } = found;
  if (!v.reason) return { argv: [verb, id] };
  let rest = cleanReason(found.rest);
  let by = null;
  if (v.by) {
    const m = rest.match(/\b(?:replaced\s+by|by)\s+([bp]\d+(?:\.\d+)*)(?![\w.]*\w)[\s,;:.]*/i);
    if (m && data.nodes[m[1].toLowerCase()]) {
      by = m[1].toLowerCase();
      rest = cleanReason(`${rest.slice(0, m.index)} ${rest.slice(m.index + m[0].length)}`);
    }
  }
  if (!rest) {
    const what = v.kind === 'gap' ? fid(data, id) : `${fid(data, id)} (${data.nodes[id].title})`;
    return needs(`${v.reason} for ${v.ing} ${what}.`, [], `${S}${verb} ${fid(data, id)} <your ${v.reason === 'a note' ? 'note' : 'reason'}>`);
  }
  if (verb === 'resolve') return { argv: ['gap', 'resolve', id, `--note=${rest}`] };
  if (verb === 'dismiss') return { argv: ['gap', 'dismiss', id, `--why=${rest}`] };
  return { argv: [verb, id, `--why=${rest}`, ...(by ? [`--by=${by}`] : [])] };
}
