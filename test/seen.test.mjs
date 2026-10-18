import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmp, sample, newProject, newBoard } from './helpers.mjs';
import { run, execute } from '../src/commands.mjs';
import { load, validate } from '../src/store.mjs';
import { displayState } from '../src/model.mjs';
import { approveCheck } from '../src/rules.mjs';
import { repoRoot, checkPath, fileHash, addSeen, seenState, seenList, seenSummary, DRAFT_NUDGE } from '../src/seen.mjs';

const NOW = '2026-10-18T10:00:00.000Z';

// A repo folder with a few files.
function repo() {
  const root = fs.realpathSync(tmp());
  fs.mkdirSync(path.join(root, 'src/db'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/db/users.js'), 'export const findByEmail = () => null;\n');
  fs.writeFileSync(path.join(root, 'package.json'), '{}\n');
  fs.mkdirSync(path.join(root, '.board/boards/LOGIN'), { recursive: true });
  return root;
}

test('repoRoot: the folder that holds .board', () => {
  assert.equal(repoRoot('/r/.board/boards/LOGIN'), '/r');
  assert.equal(repoRoot('/r/.board'), '/r');
});

test('checkPath accepts files and folders and normalises the path', () => {
  const root = repo();
  assert.deepEqual(checkPath(root, 'src/db/users.js'), { abs: path.join(root, 'src/db/users.js'), rel: 'src/db/users.js', isDir: false });
  assert.equal(checkPath(root, './src//db/users.js').rel, 'src/db/users.js');
  assert.equal(checkPath(root, 'src/db').isDir, true);
  assert.equal(checkPath(root, path.join(root, 'package.json')).rel, 'package.json');
});

test('checkPath refuses what is missing, outside, a link out, .board and the root itself', () => {
  const root = repo();
  const outside = path.join(tmp(), 'secret.txt');
  fs.writeFileSync(outside, 's');
  fs.symlinkSync(outside, path.join(root, 'link.js'));
  assert.throws(() => checkPath(root, 'missing.js'), /does not exist/);
  assert.throws(() => checkPath(root, '../x'), /outside the project/);
  assert.throws(() => checkPath(root, '/etc/hosts'), /outside the project/);
  assert.throws(() => checkPath(root, outside), /outside the project/);
  assert.throws(() => checkPath(root, 'link.js'), /outside the project/);
  assert.throws(() => checkPath(root, '.board'), /\.board\//);
  assert.throws(() => checkPath(root, '.board/boards'), /\.board\//);
  assert.throws(() => checkPath(root, '.'), /project folder itself/);
});

test('fileHash: 40 hex for a small file, null for a folder and for a file over 1 MB', () => {
  const root = repo();
  assert.match(fileHash(path.join(root, 'package.json')), /^[0-9a-f]{40}$/);
  assert.equal(fileHash(path.join(root, 'src')), null);
  const big = path.join(root, 'big.bin');
  fs.writeFileSync(big, Buffer.alloc(1048577));
  assert.equal(fileHash(big), null);
});

test('addSeen records project-level and node notes, with events and never-reused ids', () => {
  const root = repo();
  const d = sample();
  assert.equal(addSeen(d, root, { path: 'src/db/users.js', note: 'users table and findByEmail exist' }, NOW), 'recorded s1 (src/db/users.js)');
  assert.equal(addSeen(d, root, { path: 'src/db', note: 'db folder', node: 'p1', line: '3' }, NOW), 'recorded s2 (src/db)');
  assert.equal(d.seen.s1.node, null);
  assert.equal(d.seen.s1.hash.length, 40);
  assert.equal(d.seen.s2.node, 'p1');
  assert.equal(d.seen.s2.line, 3);
  assert.equal(d.seen.s2.hash, null);
  assert.equal(d.counters.s, 2);
  assert.deepEqual(d.events.map((e) => [e.actor, e.action, e.target]), [['ai', 'seen', null], ['ai', 'seen', 'p1']]);
  assert.equal(d.events[0].detail.path, 'src/db/users.js');
  validate(d);
});

test('addSeen refuses bad input and records nothing', () => {
  const root = repo();
  const d = sample();
  const bad = [
    [{ path: 'src/db/users.js', note: 'x', node: 'p9' }, /no node/i],
    [{ path: 'src/db/users.js', note: '' }, /note/],
    [{ path: 'src/db/users.js', note: 'a\nb' }, /one line/],
    [{ path: 'src/db/users.js', note: 'x'.repeat(301) }, /300/],
    [{ path: 'src/db/users.js', note: 'x', line: '0' }, /line/],
    [{ path: 'src/db/users.js', note: 'x', line: 'abc' }, /line/],
    [{ path: 'src/db/users.js', note: 'x', replaces: 's7' }, /s7/],
    [{ path: 'nope.js', note: 'x' }, /does not exist/],
  ];
  for (const [opts, re] of bad) assert.throws(() => addSeen(d, root, opts, NOW), re, JSON.stringify(opts));
  assert.deepEqual(d.seen || {}, {});
  assert.equal(d.events.length, 0);
});

test('seenState: ok, changed after an edit, gone after a delete; folders and big files never read changed', () => {
  const root = repo();
  const d = sample();
  addSeen(d, root, { path: 'src/db/users.js', note: 'file' }, NOW);
  addSeen(d, root, { path: 'src/db', note: 'folder' }, NOW);
  fs.writeFileSync(path.join(root, 'big.bin'), Buffer.alloc(1048577));
  addSeen(d, root, { path: 'big.bin', note: 'big' }, NOW);
  const states = () => Object.values(d.seen).map((n) => seenState(root, n));
  assert.deepEqual(states(), ['ok', 'ok', 'ok']);
  fs.appendFileSync(path.join(root, 'src/db/users.js'), '// more\n');
  fs.appendFileSync(path.join(root, 'big.bin'), 'x');
  assert.deepEqual(states(), ['changed', 'ok', 'ok']);
  fs.rmSync(path.join(root, 'src/db/users.js'));
  assert.deepEqual(states(), ['gone', 'ok', 'ok']);
});

test('seenList and seenSummary: lists are per node, a replaced note is marked and not counted', () => {
  const root = repo();
  const d = sample();
  addSeen(d, root, { path: 'package.json', note: 'old' }, NOW);
  addSeen(d, root, { path: 'src/db', note: 'node note', node: 'p1' }, NOW);
  addSeen(d, root, { path: 'package.json', note: 'new', replaces: 's1' }, NOW);
  const project = seenList(d, root, null);
  assert.deepEqual(project.map((n) => [n.id, n.state, n.replaced_by, n.replaces]), [['s1', 'ok', 's3', null], ['s3', 'ok', null, 's1']]);
  assert.deepEqual(seenList(d, root, 'p1').map((n) => n.id), ['s2']);
  assert.deepEqual(seenSummary(d, root), { total: 2, gone: 0, changed: 0 });
  fs.rmSync(path.join(root, 'package.json'));
  assert.deepEqual(seenSummary(d, root), { total: 2, gone: 1, changed: 0 });
});

test('notes change no state and no approval check', () => {
  const root = repo();
  const d = sample();
  const before = [displayState(d, 'p2'), approveCheck(d, 'p2')];
  addSeen(d, root, { path: 'package.json', note: 'x', node: 'p2' }, NOW);
  assert.deepEqual([displayState(d, 'p2'), approveCheck(d, 'p2')], before);
});

test('board ai seen: the command, with the key on the result and the board named', async () => {
  const { cwd } = await newProject('Login');
  fs.mkdirSync(path.join(cwd, 'src'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'src/users.js'), 'x\n');
  const out = run(['ai', 'seen', '--path', 'src/users.js', '--note', 'users module exists', '--board', 'LOGIN'], cwd);
  assert.equal(out, 'recorded LOGIN-s1 (src/users.js)');
  assert.equal(load(path.join(cwd, '.board/boards/LOGIN')).seen.s1.path, 'src/users.js');
  assert.throws(() => run(['ai', 'seen', '--path', 'nope.js', '--note', 'x'], cwd), /does not exist/);
});

test('board ai seen needs --board when there are several boards, and boards keep separate notes', async () => {
  const cwd = tmp();
  run(['init', 'Login'], cwd);
  run(['init', 'Export report'], cwd);
  fs.writeFileSync(path.join(cwd, 'a.js'), 'x\n');
  assert.throws(() => run(['ai', 'seen', '--path', 'a.js', '--note', 'a file'], cwd), /Name the board/);
  run(['ai', 'seen', '--path', 'a.js', '--note', 'a file', '--board', 'LOGIN'], cwd);
  assert.equal(Object.keys(load(path.join(cwd, '.board/boards/LOGIN')).seen || {}).length, 1);
  assert.equal(Object.keys(load(path.join(cwd, '.board/boards/EXPORT')).seen || {}).length, 0);
});

test('ai gap --seen points a gap at its note', async () => {
  const dir = await newBoard();
  fs.writeFileSync(path.join(path.dirname(dir), 'users.js'), 'x\n');
  execute(dir, ['ai', 'add', 'box', '--title', 'Login', '--user-said', 'user logs in']);
  execute(dir, ['ai', 'seen', '--path', 'users.js', '--note', 'users module exists', '--node', 'b1']);
  assert.match(execute(dir, ['ai', 'gap', 'b1', '--missing', 'Nothing says whether this reuses the users module.', '--seen', 's1']), /raised b1\.g1/);
  assert.equal(load(dir).gaps['b1.g1'].seen, 's1');
  assert.throws(() => execute(dir, ['ai', 'gap', 'b1', '--missing', 'Nothing says what happens on a repeat.', '--seen', 's9']), /s9/);
  const d = load(dir);
  d.gaps['b1.g1'].seen = 's7';
  assert.throws(() => validate(d), /s7/);
});

test('drafting nudge: on a drafted add or edit while no note exists, never otherwise', async () => {
  const dir = await newBoard();
  fs.writeFileSync(path.join(path.dirname(dir), 'users.js'), 'x\n');
  const ask = ['--drafted', '--user-said', 'draft the flow for me'];
  const first = execute(dir, ['ai', 'add', 'box', '--title', 'Login', ...ask]);
  assert.equal(first, `added b1\n${DRAFT_NUDGE}`);
  assert.equal(execute(dir, ['ai', 'add', 'box', '--title', 'Plain', '--user-said', 'then a second step']), 'added b2');
  assert.match(execute(dir, ['ai', 'edit', 'b1', '--desc', 'checks it', ...ask]), /\n.*board ai seen/);
  execute(dir, ['ai', 'seen', '--path', 'users.js', '--note', 'users module exists']);
  assert.equal(execute(dir, ['ai', 'add', 'box', '--title', 'Third', ...ask]), 'added b3');
});

test('a file written before notes existed loads, takes a note and saves', async () => {
  const dir = await newBoard();
  const file = path.join(dir, 'tree.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(raw.seen, undefined);
  assert.equal(raw.counters.s, undefined);
  fs.writeFileSync(path.join(path.dirname(dir), 'a.js'), 'x\n');
  execute(dir, ['ai', 'seen', '--path', 'a.js', '--note', 'first note']);
  const after = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(after.counters.s, 1);
  assert.equal(after.seen.s1.note, 'first note');
});

test('note text with markup is stored as text', () => {
  const root = repo();
  const d = sample();
  addSeen(d, root, { path: 'package.json', note: '<script>alert(1)</script> & "q"' }, NOW);
  assert.equal(d.seen.s1.note, '<script>alert(1)</script> & "q"');
  validate(d);
});

// ---------- text output ----------

// A board folder `dir` with a repo around it, a box b1 and notes: s1 project-level (users.js), s2 on b1 (package.json, line 4).
async function withNotes() {
  const { cwd, dir } = await newProject('Login');
  fs.mkdirSync(path.join(cwd, 'src'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'src/users.js'), 'x\n');
  fs.writeFileSync(path.join(cwd, 'package.json'), '{}\n');
  execute(dir, ['ai', 'add', 'box', '--title', 'Check password', '--user-said', 'first it checks the password']);
  execute(dir, ['ai', 'seen', '--path', 'src/users.js', '--note', 'users module exists']);
  execute(dir, ['ai', 'seen', '--path', 'package.json', '--note', 'express app', '--node', 'b1', '--line', '4']);
  return { cwd, dir };
}

test('ls: a summary and the project notes, only when notes exist', async () => {
  const { cwd, dir } = await withNotes();
  const out = execute(dir, ['ls']);
  assert.match(out, /^.*\n  code seen: 2 notes \(0 gone, 0 changed\)\n    LOGIN-s1  src\/users\.js  users module exists  \[ok\]\n/);
  assert.ok(!out.includes('express app'), 'node notes are listed by show');
  fs.rmSync(path.join(cwd, 'src/users.js'));
  assert.match(execute(dir, ['ls']), /code seen: 2 notes \(1 gone, 0 changed\)\n    LOGIN-s1 .*\[gone\]/);
  const empty = await newProject('Other');
  assert.ok(!execute(empty.dir, ['ls']).includes('code seen'));
});

test('show: the node notes with their state, or "none"; a gap says what it is because of', async () => {
  const { cwd, dir } = await withNotes();
  fs.appendFileSync(path.join(cwd, 'package.json'), '\n');
  const out = execute(dir, ['show', 'b1']);
  assert.match(out, /code seen:\n  LOGIN-s2  package\.json:4  express app  \[changed\]/);
  execute(dir, ['ai', 'gap', 'b1', '--missing', 'Nothing says whether this reuses the users module.', '--seen', 's1']);
  assert.match(execute(dir, ['show', 'b1']), /LOGIN-b1\.g1 \[open\] Nothing says whether this reuses the users module\. - because: src\/users\.js|Nothing says whether this reuses the users module\..*because: src\/users\.js/);
  execute(dir, ['ai', 'add', 'box', '--title', 'Other', '--user-said', 'then something else']);
  assert.match(execute(dir, ['show', 'b2']), /code seen: none/);
});

test('a replaced note says so, and the new one is current', async () => {
  const { dir } = await withNotes();
  execute(dir, ['ai', 'seen', '--path', 'package.json', '--note', 'express app, v5', '--node', 'b1', '--replaces', 's2']);
  const out = execute(dir, ['show', 'b1']);
  assert.match(out, /LOGIN-s2 .*\[replaced by LOGIN-s3\]/);
  assert.match(out, /LOGIN-s3 .*\[ok\]/);
});

test('check: "Code seen: none" when the node has no notes', async () => {
  const { dir } = await withNotes();
  execute(dir, ['ai', 'add', 'box', '--title', 'Other', '--user-said', 'then something else']);
  assert.match(execute(dir, ['check', 'b2']), /Code seen: none/);
  assert.ok(!/Code seen: none/.test(execute(dir, ['check', 'b1'])));
  assert.ok(!/Code seen: none/.test(execute(dir, ['check'])));
});

test('log prints the seen event with the path', async () => {
  const { dir } = await withNotes();
  assert.match(execute(dir, ['log']), /ai seen LOGIN-b1 .*package\.json/);
  assert.match(execute(dir, ['log']), /ai seen - .*users\.js/);
});

test('brief: a Code seen line only when notes exist, with gone and changed counts', async () => {
  const { text } = await import('../src/text.mjs').then((m) => ({ text: m }));
  const { cwd, dir } = await withNotes();
  const root = cwd;
  assert.match(text.brief(load(dir), { boards: [{ key: 'LOGIN', name: 'Login' }], active: 'LOGIN', root }), /\nCode seen: 2 notes \(0 gone, 0 changed\)\n/);
  fs.rmSync(path.join(cwd, 'src/users.js'));
  fs.appendFileSync(path.join(cwd, 'package.json'), '\n');
  assert.match(execute(dir, ['brief']), /\nCode seen: 2 notes \(1 gone, 1 changed\)\n/);
  const fresh = await newProject('Fresh');
  assert.ok(!execute(fresh.dir, ['brief']).includes('Code seen'));
  assert.ok(!text.brief(load(fresh.dir)).includes('Code seen'));
});

test('a gap that names a recorded file must carry --seen', async () => {
  const dir = await newBoard();
  fs.mkdirSync(path.join(path.dirname(dir), 'src'), { recursive: true });
  fs.writeFileSync(path.join(path.dirname(dir), 'src/users.js'), 'x\n');
  execute(dir, ['ai', 'add', 'box', '--title', 'Login', '--user-said', 'user logs in']);
  execute(dir, ['ai', 'seen', '--path', 'src/users.js', '--note', 'users module exists']);
  const named = ['ai', 'gap', 'b1', '--missing', 'Nothing says whether this reuses src/users.js.'];
  assert.throws(() => execute(dir, named), /names src\/users\.js, which is note s1\. Add --seen s1/);
  assert.match(execute(dir, [...named, '--seen', 's1']), /raised b1\.g1/);
  assert.match(execute(dir, ['ai', 'gap', 'b1', '--missing', 'Nothing says what happens on a repeat.']), /raised b1\.g2/);
});

test('brief: when a note is gone or changed it tells the AI to say so and read the file again', async () => {
  const { text } = await import('../src/text.mjs').then((m) => ({ text: m }));
  const { cwd, dir } = await withNotes();
  const ctx = { root: cwd };
  assert.ok(!/out of date/.test(text.brief(load(dir), ctx)));
  fs.rmSync(path.join(cwd, 'src/users.js'));
  assert.match(text.brief(load(dir), ctx), /\nSome code notes are out of date .*read those files again.*--replaces <note id>\./);
});
