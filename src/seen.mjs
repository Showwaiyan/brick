// Code seen: notes about the repo's files that Claude read, kept on the board with their paths.
// A note shows the basis of a draft; it does not prove the file was read or understood.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { addEvent, DATA_DIR, TOOL_NAME } from './store.mjs';
import { needNode } from './rules.mjs';

export const MAX_NOTE = 300;
export const MAX_HASH_BYTES = 1048576;
export const DRAFT_NUDGE = `No code has been recorded on this board. If the repo has code for this, read it and record it with \`${TOOL_NAME} ai seen\`.`;

// The repo root for a board folder: the folder that holds .board/.
export function repoRoot(boardDir) {
  const parent = path.dirname(boardDir);
  return path.basename(parent) === 'boards' ? path.dirname(path.dirname(parent)) : parent;
}

const inside = (root, p) => {
  const rel = path.relative(root, p);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};

// Resolves a path against the repo root. Throws when it is missing, outside the repo (links included),
// the repo folder itself, or inside .board/.
export function checkPath(root, p) {
  const rootReal = fs.realpathSync(root);
  const abs = path.resolve(rootReal, String(p));
  if (!inside(rootReal, abs)) throw new Error(`${p} is outside the project. Name a file or folder inside it.`);
  const rel = path.relative(rootReal, abs).split(path.sep).join('/');
  if (rel === '') throw new Error('Name a file or folder inside the project, not the project folder itself.');
  if (rel.split('/')[0] === DATA_DIR) throw new Error(`${p} is inside ${DATA_DIR}/, which is the board's own data. Name a file in the project.`);
  let real;
  try { real = fs.realpathSync(abs); } catch { throw new Error(`${p} does not exist.`); }
  if (!inside(rootReal, real)) throw new Error(`${p} is outside the project (it is a link to somewhere else).`);
  return { abs, rel, isDir: fs.statSync(abs).isDirectory() };
}

// The SHA-1 of a file, or null for a folder or a file over 1 MB.
export function fileHash(abs) {
  const st = fs.statSync(abs);
  if (!st.isFile() || st.size > MAX_HASH_BYTES) return null;
  return crypto.createHash('sha1').update(fs.readFileSync(abs)).digest('hex');
}

// One line of 1 to 300 characters.
function lintNote(text) {
  const t = String(text ?? '').trim();
  if (!t || t.length > MAX_NOTE || /[\r\n]/.test(t)) throw new Error(`--note must be one line of 1 to ${MAX_NOTE} characters.`);
  return t;
}

// Records a note. `opts` = { path, note, node, line, replaces }. Returns the result line.
export function addSeen(data, root, opts, now) {
  const note = lintNote(opts.note);
  if (!opts.path) throw new Error('--path is required: the file or folder you read.');
  if (opts.node) needNode(data, opts.node);
  let line = null;
  if (opts.line !== undefined && opts.line !== null) {
    line = Number(opts.line);
    if (!Number.isInteger(line) || line < 1) throw new Error('--line must be a whole number of 1 or more.');
  }
  data.seen = data.seen || {};
  if (opts.replaces && !data.seen[opts.replaces]) throw new Error(`There is no note "${opts.replaces}" to replace.`);
  const { abs, rel, isDir } = checkPath(root, opts.path);
  data.counters.s = (data.counters.s || 0) + 1;
  const id = `s${data.counters.s}`;
  data.seen[id] = { id, node: opts.node || null, path: rel, line, note, hash: isDir ? null : fileHash(abs), at: now, replaces: opts.replaces || null };
  addEvent(data, 'ai', 'seen', opts.node || null, { path: rel, note }, now);
  return `recorded ${id} (${rel})`;
}

// 'ok', 'changed' (the file differs from when it was seen) or 'gone', from the files as they are now.
export function seenState(root, note) {
  if (!root) return 'ok';
  const abs = path.join(root, note.path);
  let st;
  try { st = fs.statSync(abs); } catch { return 'gone'; }
  if (note.hash && st.isFile() && fileHash(abs) !== note.hash) return 'changed';
  return 'ok';
}

const num = (id) => Number(id.slice(1));

// The notes for one node (or the project, with null), in the order they were made, each with its state.
export function seenList(data, root, nodeId) {
  const all = Object.values(data.seen || {});
  return all.filter((n) => (n.node ?? null) === nodeId).sort((a, b) => num(a.id) - num(b.id)).map((n) => {
    const by = all.filter((m) => m.replaces === n.id).sort((a, b) => num(b.id) - num(a.id))[0];
    return { id: n.id, node: n.node ?? null, path: n.path, line: n.line ?? null, note: n.note, at: n.at, state: seenState(root, n),
      replaced_by: by ? by.id : null, replaces: n.replaces ?? null };
  });
}

// How many notes are current (not replaced), and how many of those are gone or changed.
export function seenSummary(data, root) {
  const all = Object.values(data.seen || {});
  const current = all.filter((n) => !all.some((m) => m.replaces === n.id));
  const states = current.map((n) => seenState(root, n));
  return { total: current.length, gone: states.filter((s) => s === 'gone').length, changed: states.filter((s) => s === 'changed').length };
}
