// Turns page data into Mermaid text and draws it with pele (SVG, made here in Node, not in the page).
// Page data is the same object the page gets, so no rule is repeated.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { fullId } from './ids.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PELE_FILE = path.join(HERE, '..', 'node_modules', 'pele', 'dist', 'pele.global.js');
const MAX_SOURCE = 100000;
const MAX_LABEL = 100;
const STATE_LABEL = { approved: 'Approved', has_gaps: 'Has gaps', drafting: 'Drafting', superseded: 'Superseded' };
const CODES = { '#': '#35;', '&': '#amp;', '"': '#quot;', '<': '#lt;', '>': '#gt;', '[': '#91;', ']': '#93;', '\\': '#92;' };

// Makes untrusted text safe inside a quoted Mermaid label: cut to length, one line, markup as entity codes.
export function escapeLabel(text) {
  let t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (t.length > MAX_LABEL) t = `${t.slice(0, MAX_LABEL - 1)}…`;
  return t.replace(/[#&"<>[\]\\]/g, (c) => CODES[c]);
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const live = (pd, ids) => ids.filter((id) => pd.nodes[id].state !== 'superseded');
const dead = (pd, ids) => ids.filter((id) => pd.nodes[id].state === 'superseded');

// Mermaid ids cannot hold a dot, so p1.1 is drawn as p1_1 (the page maps it back).
const mid = (id) => id.replace(/\./g, '_');

// One node line: title, then state, id and counts.
function nodeLine(pd, id, indent = '  ') {
  const n = pd.nodes[id];
  const sub = [`${STATE_LABEL[n.state] || n.state} · ${fullId(pd.project.key, id)}`,
    n.source === 'ai-draft' && n.state !== 'approved' && n.state !== 'superseded' ? 'AI draft' : '',
    n.active_children ? `${n.active_children} sub` : '',
    n.open_gaps ? plural(n.open_gaps, 'gap') : ''].filter(Boolean).join(' · ');
  return `${indent}${mid(id)}["${escapeLabel(n.title)}<br/>${escapeLabel(sub)}"]:::${n.state}`;
}

// The group for dropped nodes, which are drawn but not chained.
function droppedGroup(pd, ids) {
  if (!ids.length) return [];
  return ['  subgraph DROP ["Dropped"]', ...ids.map((id) => nodeLine(pd, id, '    ')), '  end'];
}

const ioLine = (id, text) => `  ${id}(["${escapeLabel(text)}"]):::io`;

// The board: input, live top-level boxes in order, output; dropped boxes in their own group.
export function boardMermaid(pd) {
  if (!pd.roots.length && !pd.project.input && !pd.project.output) return null;
  const lines = ['flowchart LR'];
  const chain = [];
  if (pd.project.input) { lines.push(ioLine('IN', pd.project.input)); chain.push('IN'); }
  for (const id of live(pd, pd.roots)) { lines.push(nodeLine(pd, id)); chain.push(id); }
  if (pd.project.output) { lines.push(ioLine('OUT', pd.project.output)); chain.push('OUT'); }
  if (chain.length > 1) lines.push(`  ${chain.map(mid).join(' --> ')}`);
  return [...lines, ...droppedGroup(pd, dead(pd, pd.roots))].join('\n');
}

// The whole tree, top down: an arrow from each parent to each child (dashed for dropped ones).
export function treeMermaid(pd) {
  if (!pd.roots.length) return null;
  const lines = ['flowchart TD', ioLine('ROOT', pd.project.name || 'Project')];
  const edges = [];
  const walk = (id) => {
    lines.push(nodeLine(pd, id));
    for (const c of pd.nodes[id].children) {
      edges.push(`  ${mid(id)} ${pd.nodes[c].state === 'superseded' ? '-.->' : '-->'} ${mid(c)}`);
      walk(c);
    }
  };
  for (const id of pd.roots) {
    edges.push(`  ROOT ${pd.nodes[id].state === 'superseded' ? '-.->' : '-->'} ${mid(id)}`);
    walk(id);
  }
  return [...lines, ...edges].join('\n');
}

// One node's own sub-steps, in order. Null when it has none.
export function nodeMermaid(pd, id) {
  const kids = pd.nodes[id].children;
  if (!kids.length) return null;
  const lines = ['flowchart LR'];
  const active = live(pd, kids);
  for (const c of active) lines.push(nodeLine(pd, c));
  if (active.length > 1) lines.push(`  ${active.map(mid).join(' --> ')}`);
  return [...lines, ...droppedGroup(pd, dead(pd, kids))].join('\n');
}

// pele's browser build, run inside a vm so it loads without a DOM, without warnings and in sync.
let pele; // undefined = not tried yet, null = not available
function loadPele() {
  if (pele !== undefined) return pele;
  try {
    const ctx = vm.createContext({});
    vm.runInContext(fs.readFileSync(PELE_FILE, 'utf8'), ctx);
    pele = typeof ctx.pele?.render === 'function' ? ctx.pele : null;
  } catch {
    pele = null;
  }
  return pele;
}

// Mermaid text to an SVG string, or null when pele is missing, the text is too big or it cannot be drawn.
export function drawSvg(text) {
  if (!text || typeof text !== 'string' || text.length > MAX_SOURCE) return null;
  const p = loadPele();
  if (!p) return null;
  try {
    const { svg } = p.render(text);
    return typeof svg === 'string' && svg.startsWith('<svg') ? svg : null;
  } catch {
    return null;
  }
}

// Adds the drawn diagrams to the page data: board_svg, tree_svg and flow_svg on each node that has sub-steps.
// A diagram that cannot be drawn is null, and the page then shows a plain list instead.
export function addDiagrams(pd) {
  pd.board_svg = drawSvg(boardMermaid(pd));
  pd.tree_svg = drawSvg(treeMermaid(pd));
  for (const id of Object.keys(pd.nodes)) pd.nodes[id].flow_svg = drawSvg(nodeMermaid(pd, id));
  return pd;
}
