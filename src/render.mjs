// Builds tree.html: one self-contained file (data + page.js + page.css inlined).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load, TOOL_NAME } from './store.mjs';
import { children, activeChildren, displayState, openGaps } from './model.mjs';
import { eventsFor } from './text.mjs';
import { addDiagrams } from './flow.mjs';
import { compareIds } from './ids.mjs';
import { renderOverview } from './overview.mjs';
import { shownTitle } from './title.mjs';
import { seenList, repoRoot } from './seen.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Short text for an event's detail, shown in the page history.
function summary(e) {
  return Object.entries(e.detail || {})
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => (k === 'via' ? v : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v)))
    .join(' · ');
}

// Everything the page needs, with all rules already applied (the page has none).
export function pageData(data, now, opts = {}) {
  const notes = (id) => (opts.root ? seenList(data, opts.root, id) : []);
  const nodes = {};
  for (const n of Object.values(data.nodes)) {
    const gaps = Object.values(data.gaps).filter((g) => g.node === n.id)
      .sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || compareIds(a.id, b.id));
    nodes[n.id] = {
      id: n.id, kind: n.kind, parent: n.parent, title: n.title, description: n.description,
      contract: n.contract, source: n.source, said: n.said, superseded: n.superseded,
      state: displayState(data, n.id),
      children: children(data, n.id).map((c) => c.id),
      active_children: activeChildren(data, n.id).length,
      open_gaps: openGaps(data, n.id).length,
      gaps: gaps.map((g) => ({ id: g.id, missing: g.missing, where: g.where, status: g.status, note: g.note, kind: g.kind || null,
        seen: g.seen && data.seen?.[g.seen] ? { id: g.seen, path: data.seen[g.seen].path } : null })),
      seen: notes(n.id),
      history: eventsFor(data, n.id).slice(0, 10).map((e) => ({ seq: e.seq, at: e.at, actor: e.actor, action: e.action, summary: summary(e) })),
    };
  }
  const states = Object.values(nodes).map((n) => n.state);
  return {
    project: { ...data.project, shown: shownTitle(data.project), seen: notes(null) }, generated_at: now, tool: TOOL_NAME, overview: opts.overview || null,
    roots: children(data, null).map((n) => n.id), nodes,
    counts: {
      approved: states.filter((s) => s === 'approved').length,
      drafting: Object.values(data.nodes).filter((n) => n.status === 'drafting').length,
      superseded: states.filter((s) => s === 'superseded').length,
      open_gaps: Object.values(data.gaps).filter((g) => g.status === 'open').length,
    },
  };
}

// Characters that must not appear raw inside the embedded JSON.
const LINE_SEP = new RegExp(String.fromCharCode(0x2028), 'g');
const PARA_SEP = new RegExp(String.fromCharCode(0x2029), 'g');

// Makes JSON safe inside a <script> tag: no "<", no line-separator characters.
export function safeJson(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(LINE_SEP, '\\u2028')
    .replace(PARA_SEP, '\\u2029');
}

// Escapes text for use inside an HTML element (only the <title> needs it).
const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The whole page as one string.
export function renderHtml(data, now = new Date().toISOString(), opts = {}) {
  const css = fs.readFileSync(path.join(HERE, 'page.css'), 'utf8');
  const js = ['canvas.js', 'page.js'].map((f) => fs.readFileSync(path.join(HERE, f), 'utf8')).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(shownTitle(data.project))} - ${TOOL_NAME}</title>
<style>
${css}</style>
</head>
<body>
<div id="app"></div>
<noscript><p>This page needs JavaScript to draw the board. Run "${TOOL_NAME} ls" for a text view.</p></noscript>
<script id="data" type="application/json">${safeJson(addDiagrams(pageData(data, now, opts)))}</script>
<script>
${js}</script>
</body>
</html>
`;
}

// Renders tree.html into the data folder (temp file + rename). Returns its path.
export function renderFile(dir) {
  const file = path.join(dir, 'tree.html');
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, renderHtml(load(dir), undefined, { overview: dataDirOf(dir) ? '../../index.html' : null, root: repoRoot(dir) }));
  fs.renameSync(tmp, file);
  return file;
}

// The data folder when `dir` is a board folder (<data>/boards/<KEY>), else null.
function dataDirOf(dir) {
  const boards = path.dirname(dir);
  return path.basename(boards) === 'boards' ? path.dirname(boards) : null;
}

// Renders after a save, and refreshes the overview. A failure only warns: the data is already saved.
export function renderQuiet(dir) {
  try {
    renderFile(dir);
    if (dataDirOf(dir)) renderOverview(dataDirOf(dir));
  } catch (e) {
    console.error(`warning: could not update tree.html (your data is saved): ${e.message}`);
  }
}
