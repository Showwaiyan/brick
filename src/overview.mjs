// The overview page: one card per board, linking to each board's own page. Static HTML, no script, no network.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listBoards, activeKey, TOOL_NAME } from './store.mjs';
import { boardSummary } from './boards.mjs';
import { openFile } from './open.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const EXTRA_CSS = `
.overview { max-width: 760px; margin: 0 auto; padding: 24px 16px; display: grid; gap: 16px; }
.boards { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
a.board-card { display: grid; gap: 2px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--card); color: inherit; text-decoration: none; }
a.board-card:hover { border-color: #2F6FED; }
.board-card .card-title { font-size: 17px; }
div.board-card { display: grid; gap: 2px; padding: 12px 14px; border: 1px dashed var(--border); border-radius: 12px; color: var(--muted); }
`;

// One board as a card.
function cardHtml(b, active) {
  const mark = b.key === active ? ' · Active' : '';
  if (b.broken) {
    return `<li><div class="board-card"><span class="card-title">${escapeHtml(b.key)} (cannot be read)</span><span class="card-sub">${escapeHtml(b.broken)}</span></div></li>`;
  }
  const c = b.counts;
  const facts = [`${c.approved} approved`, `${c.drafting + c.has_gaps} drafting`, plural(b.open_gaps, 'open gap'), ...(c.superseded ? [`${c.superseded} superseded`] : [])];
  return `<li><a class="board-card" href="boards/${escapeHtml(b.key)}/tree.html"><span class="card-title">${escapeHtml(b.shown || b.name)}</span>` +
    `<span class="card-state">${escapeHtml(b.key)}${mark}</span><span class="card-sub">${facts.join(' · ')}</span></a></li>`;
}

// The whole overview page as one string. `boards` are boardSummary() results.
export function overviewHtml(boards, active = null) {
  const css = fs.readFileSync(path.join(HERE, 'page.css'), 'utf8');
  const body = boards.length
    ? `<ul class="boards">${boards.map((b) => cardHtml(b, active)).join('')}</ul>`
    : '<p class="muted">No boards yet. Run /brick:init to make one.</p>';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Boards - ${TOOL_NAME}</title>
<style>
${css}${EXTRA_CSS}</style>
</head>
<body>
<main class="overview">
<h1>Boards</h1>
${body}
<p class="muted">Read-only. Decide with the /brick commands in Claude Code.</p>
</main>
</body>
</html>
`;
}

// Writes index.html in the data folder (temp file + rename). Returns its path.
export function renderOverview(dataDir) {
  const file = path.join(dataDir, 'index.html');
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, overviewHtml(listBoards(dataDir).map(boardSummary), activeKey(dataDir)));
  fs.renameSync(tmp, file);
  return file;
}

// Renders the overview and opens it. Returns { file, opened }. `opener` is injectable for tests.
export function openOverview(dataDir, opener = openFile) {
  const file = renderOverview(dataDir);
  return { file, opened: opener(file) };
}
