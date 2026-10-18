// Turns page data into Mermaid text and draws it with pele (SVG, made here in Node, not in the page).
// Page data is the same object the page gets, so no rule is repeated.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { fullId } from './ids.mjs';
import { TAG, tagsFor, rootTags, layoutTags, wrapWidthFor } from './tags.mjs';

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

// Pele pads a box by 16 on each side, and a placeholder letter "x" is about 8 wide at its size.
const BOX_PAD = 32;
const PLACEHOLDER = 8;
// Pele puts a line's text baseline this far below the line's centre.
const BASELINE = 5.6;

const cutTitle = (t) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL);
const tagLayout = (tags, title) => layoutTags(tags, wrapWidthFor(cutTitle(title)));

// A bold title and, under it, one placeholder line per row of tags. The placeholders only make the box
// wide and tall enough; addTags blanks them and draws the tags there.
function taggedLabel(title, layout) {
  if (!layout.rows.length) return `<b>${escapeLabel(title)}</b>`;
  const inner = Math.max(0, layout.width + 2 * TAG.PAD - BOX_PAD);
  const filler = 'x'.repeat(Math.max(1, Math.ceil(inner / PLACEHOLDER)));
  return `<b>${escapeLabel(title)}</b>${layout.rows.map(() => `<br/>${filler}`).join('')}`;
}

// One node line. 'tags' mode: bold title plus rows reserved for tags. 'plain' mode: title, then state, id and counts.
function nodeLine(pd, id, indent = '  ', mode = 'tags') {
  const n = pd.nodes[id];
  if (mode === 'tags') {
    return `${indent}${mid(id)}["${taggedLabel(n.title, tagLayout(tagsFor(pd, id), n.title))}"]:::${n.state}`;
  }
  const sub = [`${STATE_LABEL[n.state] || n.state} · ${fullId(pd.project.key, id)}`,
    n.source === 'ai-draft' && n.state !== 'approved' && n.state !== 'superseded' ? 'AI draft' : '',
    n.active_children ? `${n.active_children} sub` : '',
    n.open_gaps ? plural(n.open_gaps, 'gap') : ''].filter(Boolean).join(' · ');
  return `${indent}${mid(id)}["${escapeLabel(n.title)}<br/>${escapeLabel(sub)}"]:::${n.state}`;
}

// The group for dropped nodes, which are drawn but not chained.
function droppedGroup(pd, ids, mode) {
  if (!ids.length) return [];
  return ['  subgraph DROP ["Dropped"]', ...ids.map((id) => nodeLine(pd, id, '    ', mode)), '  end'];
}

const ioLine = (id, text) => `  ${id}(["${escapeLabel(text)}"]):::io`;

// The shown title of the board, for the root of the tree.
const rootTitle = (pd) => pd.project.shown || pd.project.name || 'Project';

// The root node of the tree: the short title and, in tags mode, a row for the board key.
function rootLine(pd, mode) {
  if (mode !== 'tags') return ioLine('ROOT', rootTitle(pd));
  return `  ROOT(["${taggedLabel(rootTitle(pd), tagLayout(rootTags(pd), rootTitle(pd)))}"]):::io`;
}

// The board: input, live top-level boxes in order, output; dropped boxes in their own group.
export function boardMermaid(pd, mode = 'tags') {
  if (!pd.roots.length && !pd.project.input && !pd.project.output) return null;
  const lines = ['flowchart LR'];
  const chain = [];
  if (pd.project.input) { lines.push(ioLine('IN', pd.project.input)); chain.push('IN'); }
  for (const id of live(pd, pd.roots)) { lines.push(nodeLine(pd, id, '  ', mode)); chain.push(id); }
  if (pd.project.output) { lines.push(ioLine('OUT', pd.project.output)); chain.push('OUT'); }
  if (chain.length > 1) lines.push(`  ${chain.map(mid).join(' --> ')}`);
  return [...lines, ...droppedGroup(pd, dead(pd, pd.roots), mode)].join('\n');
}

// The whole tree, top down: an arrow from each parent to each child (dashed for dropped ones).
export function treeMermaid(pd, mode = 'tags') {
  if (!pd.roots.length) return null;
  const lines = ['flowchart TD', rootLine(pd, mode)];
  const edges = [];
  const walk = (id) => {
    lines.push(nodeLine(pd, id, '  ', mode));
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
export function nodeMermaid(pd, id, mode = 'tags') {
  const kids = pd.nodes[id].children;
  if (!kids.length) return null;
  const lines = ['flowchart LR'];
  const active = live(pd, kids);
  for (const c of active) lines.push(nodeLine(pd, c, '  ', mode));
  if (active.length > 1) lines.push(`  ${active.map(mid).join(' --> ')}`);
  return [...lines, ...droppedGroup(pd, dead(pd, kids), mode)].join('\n');
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

const NODE_GROUP = /<g class="pele-node ([^"]*)" data-id="([^"]+)" transform="translate\(([-\d.]+),([-\d.]+)\)">([\s\S]*?)<\/g>/g;
const RECT = /<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/;
const TSPAN = /<tspan x="[^"]*" y="([-\d.]+)"[^>]*>([^<]*)<\/tspan>/g;
const xml = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The SVG for one tag: a rounded box and its text, centred on (cx, cy)-relative coordinates.
function tagMarkup(t, x, cy) {
  const r = (n) => Math.round(n * 100) / 100;
  const state = t.state ? ` tag-state-${t.state}` : '';
  return `<g class="tag tag-${t.kind}${state}"><rect x="${r(x)}" y="${r(cy - TAG.H / 2)}" width="${t.w}" height="${TAG.H}" rx="${TAG.H / 2}"/>` +
    `<text class="tag-text" x="${r(x + t.w / 2)}" y="${r(cy)}" text-anchor="middle" dominant-baseline="central">${xml(t.text)}</text></g>`;
}

// Draws the tags into the rows that taggedLabel reserved. Returns the SVG, or null when it does not look as expected
// (then the caller draws the plain labels instead).
export function addTags(svg, pd) {
  if (typeof svg !== 'string' || !svg.includes('class="pele-nodes"')) return null;
  const byMid = new Map(Object.keys(pd.nodes).map((id) => [mid(id), id]));
  let ok = true;
  const out = svg.replace(NODE_GROUP, (whole, cls, did, cx, cy, inner) => {
    let tags;
    let title;
    let centered = false;
    if (did === 'ROOT') { tags = rootTags(pd); title = rootTitle(pd); centered = true; }
    else if (byMid.has(did)) { const id = byMid.get(did); tags = tagsFor(pd, id); title = pd.nodes[id].title; }
    else return whole;
    const layout = tagLayout(tags, title);
    if (!layout.rows.length) return whole;
    const rect = inner.match(RECT);
    const spans = [...inner.matchAll(TSPAN)];
    if (!rect || spans.length <= layout.rows.length) { ok = false; return whole; }
    const left = Number(rect[1]);
    const width = Number(rect[3]);
    if (width < layout.width + 2 * TAG.PAD) { ok = false; return whole; }
    const reserved = spans.slice(-layout.rows.length);
    let body = inner;
    for (const sp of reserved) body = body.replace(sp[0], sp[0].replace(sp[2], ''));
    const tagsSvg = layout.rows.map((row, r) => {
      const centreY = Number(reserved[r][1]) - BASELINE;
      const shift = centered ? (width - layout.width) / 2 : TAG.PAD;
      return row.map((t) => tagMarkup(t, left + shift + t.x, centreY)).join('');
    }).join('');
    return whole.replace(inner, `${body}<g class="pele-tags">${tagsSvg}</g>`);
  });
  return ok ? out : null;
}

// The tagger can be swapped by tests to force the plain fallback.
let tagger = addTags;
export function __setTagger(fn) { tagger = fn || addTags; }

// One diagram: tagged when that works, with plain labels otherwise. Null when nothing can be drawn.
function drawTagged(build, pd) {
  const svg = drawSvg(build('tags'));
  if (!svg) return null;
  return tagger(svg, pd) || drawSvg(build('plain'));
}

// Adds the drawn diagrams to the page data: board_svg, tree_svg and flow_svg on each node that has sub-steps.
// A diagram that cannot be drawn is null, and the page then shows a plain list instead.
export function addDiagrams(pd) {
  pd.board_svg = drawTagged((m) => boardMermaid(pd, m), pd);
  pd.tree_svg = drawTagged((m) => treeMermaid(pd, m), pd);
  for (const id of Object.keys(pd.nodes)) pd.nodes[id].flow_svg = drawTagged((m) => nodeMermaid(pd, id, m), pd);
  return pd;
}
