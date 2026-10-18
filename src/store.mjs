// Storage layer: finds the project, validates, and writes tree.json safely.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parentOf, deriveKey, KEY_RE } from './ids.mjs';

// The one place the tool's name lives. The data folder is derived from it.
export const TOOL_NAME = 'board';
export const DATA_DIR = `.${TOOL_NAME}`;
// The plugin's name; humans type /<PLUGIN_NAME>:<action>.
export const PLUGIN_NAME = 'brick';

const STATUSES = ['drafting', 'approved', 'superseded'];
const GAP_STATUSES = ['open', 'resolved', 'dismissed'];
const LOCK_RETRIES = 5;
const LOCK_WAIT_MS = 200;
const LOCK_STALE_MS = 10000;

// ---------- finding the project ----------

// Runs a git command in cwd; returns trimmed stdout or null if git fails.
function git(cwd, args) {
  try {
    const out = execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'ignore'] });
    return out.toString().trim();
  } catch {
    return null;
  }
}

// Resolves symlinks so paths compare equal (macOS /var vs /private/var).
function real(p) {
  try { return fs.realpathSync(p); } catch { return path.resolve(p); }
}

// True when cwd is inside a linked git worktree (not the main checkout).
export function isLinkedWorktree(cwd) {
  const gitDir = git(cwd, ['rev-parse', '--git-dir']);
  const common = git(cwd, ['rev-parse', '--git-common-dir']);
  if (gitDir === null || common === null) return false;
  return real(path.resolve(cwd, gitDir)) !== real(path.resolve(cwd, common));
}

// Finds the project. Returns { root, dir, exists, warnings }.
// In a git repo, root is the main checkout, so all worktrees share one data folder.
export function findProject(cwd = process.cwd()) {
  const warnings = [];
  const common = git(cwd, ['rev-parse', '--git-common-dir']);
  if (common !== null) {
    const root = path.dirname(real(path.resolve(cwd, common)));
    const dir = path.join(root, DATA_DIR);
    if (isLinkedWorktree(cwd)) {
      const top = git(cwd, ['rev-parse', '--show-toplevel']);
      if (top && fs.existsSync(path.join(real(top), DATA_DIR))) {
        warnings.push(`Ignoring ${DATA_DIR}/ inside this worktree; using the main checkout: ${root}`);
      }
    }
    return { root, dir, exists: hasBoards(dir), warnings };
  }
  // Not a git repo (or git is missing): walk up looking for the data folder.
  let cur = real(cwd);
  for (;;) {
    const dir = path.join(cur, DATA_DIR);
    if (fs.existsSync(dir)) return { root: cur, dir, exists: hasBoards(dir), warnings };
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  const root = real(cwd);
  return { root, dir: path.join(root, DATA_DIR), exists: false, warnings };
}

// ---------- boards ----------

// The data folder holds boards/<KEY>/tree.json. A tree.json straight in it is the old layout.
export const BOARDS_DIR = 'boards';
export const boardsDir = (dataDir) => path.join(dataDir, BOARDS_DIR);

// Every board in the data folder, sorted by key.
export function listBoards(dataDir) {
  let names;
  try { names = fs.readdirSync(boardsDir(dataDir)); } catch { return []; }
  return names.filter((k) => fs.existsSync(path.join(boardsDir(dataDir), k, 'tree.json')))
    .sort().map((key) => ({ key, dir: path.join(boardsDir(dataDir), key) }));
}

// True when there is a board in the old layout or the new one.
function hasBoards(dataDir) {
  return fs.existsSync(path.join(dataDir, 'tree.json')) || listBoards(dataDir).length > 0;
}

// Creates a board from `data` (its project.key names the folder). Returns the board folder.
export function createBoard(dataDir, data) {
  const key = data.project.key;
  if (!KEY_RE.test(String(key))) throw new Error(`"${key}" is not a board key. Use 2 to 6 capital letters or digits, starting with a letter.`);
  const dir = path.join(boardsDir(dataDir), key);
  if (fs.existsSync(path.join(dir, 'tree.json'))) throw new Error(`Board ${key} already exists.`);
  create(dir, data);
  return dir;
}

// The key in `active`, if it names a board that exists.
export function activeKey(dataDir) {
  try {
    const key = fs.readFileSync(path.join(dataDir, 'active'), 'utf8').trim().toUpperCase();
    return listBoards(dataDir).some((b) => b.key === key) ? key : null;
  } catch {
    return null;
  }
}

// Points `active` at a board (temp file + rename).
export function setActive(dataDir, key) {
  const file = path.join(dataDir, 'active');
  const tmpFile = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmpFile, `${key}\n`);
  fs.renameSync(tmpFile, file);
}

// Moves a tree.json from the old layout into boards/<KEY>/. Returns the key, or null if there was nothing to move.
// Safe to run twice: the key is written into the old file first, then one rename moves it.
export function migrateLegacy(dataDir) {
  const legacy = path.join(dataDir, 'tree.json');
  if (!fs.existsSync(legacy)) return null;
  const lock = acquireLock(dataDir);
  try {
    if (!fs.existsSync(legacy)) return null;
    let data;
    try {
      data = JSON.parse(fs.readFileSync(legacy, 'utf8'));
      validate(data);
    } catch (e) {
      throw new Error(`${legacy} is not valid, so it was not moved: ${e.message}`);
    }
    let key = data.project.key;
    if (!KEY_RE.test(String(key))) {
      key = deriveKey(data.project.name, listBoards(dataDir).map((b) => b.key));
      data.project.key = key;
      writeFile(dataDir, data);
    }
    const dest = path.join(boardsDir(dataDir), key);
    if (fs.existsSync(path.join(dest, 'tree.json'))) throw new Error(`Cannot move ${legacy}: board ${key} already exists.`);
    fs.mkdirSync(dest, { recursive: true });
    fs.renameSync(legacy, path.join(dest, 'tree.json'));
    const html = path.join(dataDir, 'tree.html');
    if (fs.existsSync(html)) fs.renameSync(html, path.join(dest, 'tree.html'));
    return key;
  } finally {
    fs.rmSync(lock, { force: true });
  }
}

// ---------- data helpers ----------

// A brand-new, empty data file.
export function emptyData(name, input = null, output = null, now = new Date().toISOString(), key = null) {
  return {
    version: 1,
    project: { name, input, output, created_at: now, ...(key ? { key } : {}) },
    counters: { b: 0, p: 0, g: 0 },
    nodes: {},
    gaps: {},
    events: [],
  };
}

// Takes the next id for a prefix ('b', 'p' or 'g'). Counters only go up.
export function nextId(data, prefix) {
  data.counters[prefix] += 1;
  return `${prefix}${data.counters[prefix]}`;
}

// The id for a new node. Boxes and problems directly under a box take the next flat number;
// deeper nodes take their parent's id plus the next number among that parent's children.
export function newNodeId(data, kind, parent) {
  if (kind === 'box') return nextId(data, 'b');
  if (data.nodes[parent].kind === 'box') return nextId(data, 'p');
  return `${parent}.${highest(Object.keys(data.nodes), `${parent}.`) + 1}`;
}

// The id for a new gap on a node: the node's id, ".g", and the next number for that node.
export function newGapId(data, nodeId) {
  return `${nodeId}.g${highest(Object.keys(data.gaps), `${nodeId}.g`) + 1}`;
}

// The highest number that follows `prefix` in ids like `<prefix><digits>` (0 if none).
function highest(ids, prefix) {
  return Math.max(0, ...ids.filter((id) => id.startsWith(prefix) && /^\d+$/.test(id.slice(prefix.length))).map((id) => Number(id.slice(prefix.length))));
}

// Appends an event with the next sequence number. Events are never edited.
export function addEvent(data, actor, action, target, detail = {}, now = new Date().toISOString()) {
  data.events.push({ seq: data.events.length + 1, at: now, actor, action, target, detail });
}

// ---------- validation ----------

// Checks the whole file. Throws one Error listing every problem found.
export function validate(data) {
  const errs = [];
  if (!data || data.version !== 1) throw new Error('tree.json: unsupported or missing version');
  const nodes = data.nodes || {};
  const siblings = new Map();
  for (const [key, n] of Object.entries(nodes)) {
    if (n.id !== key) errs.push(`node key ${key} does not match its id ${n.id}`);
    if (!['box', 'problem'].includes(n.kind)) errs.push(`${key}: bad kind ${n.kind}`);
    if (!STATUSES.includes(n.status)) errs.push(`${key}: bad status ${n.status}`);
    if ((n.status === 'superseded') !== (n.superseded !== null && n.superseded !== undefined)) {
      errs.push(`${key}: status and superseded disagree`);
    }
    if (n.kind === 'box' && n.parent !== null) errs.push(`${key}: a box must have parent null`);
    if (n.kind === 'problem') {
      const p = nodes[n.parent];
      if (!p) errs.push(`${key}: parent ${n.parent} does not exist`);
      else if (!['box', 'problem'].includes(p.kind)) errs.push(`${key}: bad parent kind`);
    }
    const slot = `${n.parent}#${n.order}`;
    if (siblings.has(slot)) errs.push(`${key}: order ${n.order} already used by ${siblings.get(slot)}`);
    siblings.set(slot, key);
    if (key.includes('.')) {
      if (parentOf(key) !== n.parent) errs.push(`${key}: id does not match its parent`);
    } else {
      const num = Number(key.slice(1));
      if (data.counters[key[0]] === undefined || data.counters[key[0]] < num) errs.push(`${key}: counter is behind`);
    }
  }
  for (const key of Object.keys(nodes)) {
    const seen = new Set();
    for (let cur = nodes[key]; cur && cur.parent; cur = nodes[cur.parent]) {
      if (seen.has(cur.id)) { errs.push(`${key}: parent chain has a cycle`); break; }
      seen.add(cur.id);
    }
  }
  for (const [key, g] of Object.entries(data.gaps || {})) {
    if (g.id !== key) errs.push(`gap key ${key} does not match its id ${g.id}`);
    if (!nodes[g.node]) errs.push(`${key}: node ${g.node} does not exist`);
    if (!GAP_STATUSES.includes(g.status)) errs.push(`${key}: bad status ${g.status}`);
    if (key.includes('.')) {
      if (parentOf(key) !== g.node) errs.push(`${key}: id does not match its node`);
    } else if (!(data.counters.g >= Number(key.slice(1)))) errs.push(`${key}: counter is behind`);
  }
  (data.events || []).forEach((e, i) => {
    if (e.seq !== i + 1) errs.push(`event ${i + 1}: seq is ${e.seq}`);
  });
  if (errs.length) throw new Error(`tree.json is invalid:\n- ${errs.join('\n- ')}`);
}

// ---------- reading and writing ----------

// Reads and validates tree.json from a data folder.
export function load(dir) {
  const file = path.join(dir, 'tree.json');
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`Cannot read ${file}: ${e.message}`);
  }
  validate(data);
  return data;
}

// Sleeps without spinning the CPU (the store is synchronous on purpose).
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Takes .lock (exclusive create). Retries, and takes over a stale lock.
function acquireLock(dir) {
  const lock = path.join(dir, '.lock');
  for (let i = 0; i < LOCK_RETRIES; i++) {
    try {
      fs.closeSync(fs.openSync(lock, 'wx'));
      return lock;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try {
        if (Date.now() - fs.statSync(lock).mtimeMs > LOCK_STALE_MS) { fs.unlinkSync(lock); continue; }
      } catch { /* lock vanished; retry */ }
      sleep(LOCK_WAIT_MS);
    }
  }
  throw new Error(`Another ${TOOL_NAME} command is writing. Try again in a moment.`);
}

// Validates, then writes via temp file + fsync + rename. Caller holds the lock.
function writeFile(dir, data) {
  validate(data);
  const tmp = path.join(dir, `tree.json.${process.pid}.tmp`);
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(fd, JSON.stringify(data, null, 2) + '\n');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, path.join(dir, 'tree.json'));
}

// Locks, runs fn(data) on a fresh load, saves the result. Returns fn's return value.
export function mutate(dir, fn) {
  const lock = acquireLock(dir);
  try {
    const data = load(dir);
    const result = fn(data);
    writeFile(dir, data);
    return result;
  } finally {
    fs.rmSync(lock, { force: true });
  }
}

// Writes a brand-new tree.json (used by init). Creates the folder if needed.
export function create(dir, data) {
  fs.mkdirSync(dir, { recursive: true });
  const lock = acquireLock(dir);
  try {
    writeFile(dir, data);
  } finally {
    fs.rmSync(lock, { force: true });
  }
}
