import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmp, newProject } from './helpers.mjs';
import { create, emptyData, load } from '../src/store.mjs';
import { runSlash } from '../src/slash.mjs';
import { sessionStart } from '../src/guard.mjs';

const BIN = path.resolve('bin/board.mjs');
const run = (cwd, ...a) => spawnSync('node', [BIN, ...a], { cwd, encoding: 'utf8' });
const read = (cwd, f) => fs.readFileSync(path.join(cwd, f), 'utf8');
const active = (cwd) => read(cwd, '.board/active').trim();

// A project with boards LOGIN and EXPORT (EXPORT is active), each with one box.
function two() {
  const cwd = tmp();
  run(cwd, 'init', 'Login');
  run(cwd, 'add', 'box', 'Check password');
  run(cwd, 'init', 'Export report');
  run(cwd, 'add', 'box', 'Write CSV');
  return cwd;
}

test('one board is implied, and results carry the key', () => {
  const cwd = tmp();
  run(cwd, 'init', 'Login');
  const r = run(cwd, 'add', 'box', 'One');
  assert.equal(r.stdout.trim(), 'added LOGIN-b1');
  assert.match(run(cwd, 'ls').stdout, /^Login \[LOGIN\]\n {2}LOGIN-b1 {2}One/);
});

test('the active board is used when nothing names one', () => {
  const cwd = two();
  assert.match(run(cwd, 'ls').stdout, /Export report \[EXPORT\]/);
  assert.equal(run(cwd, 'add', 'box', 'More').stdout.trim(), 'added EXPORT-b2');
});

test('--board and a full id name the board; a write sets it active, a read does not', () => {
  const cwd = two();
  assert.match(run(cwd, 'ls', '--board', 'LOGIN').stdout, /Login \[LOGIN\]/);
  assert.match(run(cwd, 'ls', '--board=login').stdout, /Login \[LOGIN\]/);
  assert.equal(active(cwd), 'EXPORT', 'a read leaves the pointer alone');
  assert.match(run(cwd, 'show', 'LOGIN-b1').stdout, /^LOGIN-b1 {2}Check password/);
  assert.equal(active(cwd), 'EXPORT');
  assert.equal(run(cwd, 'edit', 'LOGIN-b1', '--desc', 'x').stdout.trim(), 'edited LOGIN-b1 (desc)');
  assert.equal(active(cwd), 'LOGIN', 'a write with a named board makes it active');
});

test('an unknown board, two different boards, and a flag before the command are errors', () => {
  const cwd = two();
  const bad = run(cwd, 'ls', '--board', 'NOPE');
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /no board "NOPE".*EXPORT, LOGIN/);
  const both = run(cwd, 'show', 'LOGIN-b1', '--board', 'EXPORT');
  assert.equal(both.status, 1);
  assert.match(both.stderr, /different boards: EXPORT, LOGIN|different boards: LOGIN, EXPORT/);
  assert.match(run(cwd, '--board', 'LOGIN', 'ls').stderr, /after the command/);
});

test('several boards and no usable active board: the command stops and writes nothing', () => {
  const cwd = two();
  fs.rmSync(path.join(cwd, '.board/active'));
  const before = fs.readdirSync(path.join(cwd, '.board')).sort();
  const r = run(cwd, 'add', 'box', 'Lost');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Several boards: EXPORT, LOGIN\. Name one/);
  fs.writeFileSync(path.join(cwd, '.board/active'), 'GONE\n');
  assert.match(run(cwd, 'ls').stderr, /Several boards/);
  fs.rmSync(path.join(cwd, '.board/active'));
  assert.deepEqual(fs.readdirSync(path.join(cwd, '.board')).sort(), before);
  assert.equal(Object.keys(load(path.join(cwd, '.board/boards/EXPORT')).nodes).length, 1);
});

test('a title or quote that merely contains an id is not rewritten', () => {
  const cwd = two();
  run(cwd, 'add', 'box', 'LOGIN-b1 notes', '--board', 'LOGIN');
  assert.equal(load(path.join(cwd, '.board/boards/LOGIN')).nodes.b2.title, 'LOGIN-b1 notes');
  run(cwd, 'ai', 'edit', 'b1', '--user-said', 'the b1 step runs before p1', '--desc', 'x', '--board', 'LOGIN');
  const show = run(cwd, 'show', 'b1', '--board', 'LOGIN').stdout;
  assert.match(show, /"the b1 step runs before p1"/);
});

test('results and reads print full ids', () => {
  const cwd = tmp();
  run(cwd, 'init', 'Login');
  run(cwd, 'add', 'box', 'One');
  assert.equal(run(cwd, 'add', 'problem', 'Hash it', '--parent', 'b1').stdout.trim(), 'added LOGIN-p1 under LOGIN-b1');
  assert.equal(run(cwd, 'add', 'problem', 'Salt it', '--parent', 'LOGIN-p1').stdout.trim(), 'added LOGIN-p1.1 under LOGIN-p1');
  const gap = run(cwd, 'ai', 'gap', 'p1.1', '--missing', 'Nothing says what happens on an empty list.');
  assert.equal(gap.stdout.trim(), 'raised LOGIN-p1.1.g1 on LOGIN-p1.1');
  assert.match(run(cwd, 'show', 'p1.1').stdout, /LOGIN-p1\.1\.g1 \[open\]/);
  assert.match(run(cwd, 'ls').stdout, /LOGIN-p1\.1 {2}Salt it {2}\[has gaps\] {2}1 open gap/);
  assert.match(run(cwd, 'check', 'LOGIN-p1').stdout, /LOGIN-p1\.1/);
  assert.match(run(cwd, 'brief').stdout, /LOGIN-p1\.1\.g1 on LOGIN-p1\.1/);
});

test('use, boards and unknown keys', () => {
  const cwd = two();
  assert.equal(run(cwd, 'use', 'login').stdout.trim(), 'using board LOGIN');
  assert.match(run(cwd, 'ls').stdout, /Login \[LOGIN\]/);
  assert.match(run(cwd, 'use', 'NOPE').stderr, /no board "NOPE"/);
  const list = run(cwd, 'boards').stdout;
  assert.match(list, /^\* LOGIN {2}Login {2}0 approved, 1 drafting, 0 with gaps$/m);
  assert.match(list, /^ {2}EXPORT {2}Export report/m);
});

test('a board in the old layout is moved on first use, and a second board can follow', () => {
  const cwd = tmp();
  create(path.join(cwd, '.board'), emptyData('Login'));
  assert.match(run(cwd, 'ls').stdout, /^Login \[LOGIN\]/);
  assert.ok(fs.existsSync(path.join(cwd, '.board/boards/LOGIN/tree.json')));
  assert.equal(fs.existsSync(path.join(cwd, '.board/tree.json')), false);
  assert.equal(run(cwd, 'init', 'Export report').status, 0);
  assert.deepEqual(run(cwd, 'boards').stdout.trim().split('\n').map((l) => l.slice(0, 8)), ['* EXPORT', '  LOGIN ']);
});

test('typed commands: the active board, a full id, or a question; never a guess', async () => {
  const cwd = two();
  assert.equal(runSlash('brick:approve', 'b1', cwd), '[brick] approved EXPORT-b1');
  assert.equal(runSlash('brick:approve', 'LOGIN-b1', cwd), '[brick] approved LOGIN-b1');
  assert.equal(active(cwd), 'LOGIN', 'naming a board makes it active');
  assert.match(runSlash('brick:reopen', 'login-b1 changed my mind', cwd), /^\[brick\] reopened LOGIN-b1/);
  fs.rmSync(path.join(cwd, '.board/active'));
  const before = read(cwd, '.board/boards/EXPORT/tree.json') + read(cwd, '.board/boards/LOGIN/tree.json');
  const out = runSlash('brick:approve', 'b1', cwd);
  assert.match(out, /^\[brick\] NEEDS: which board\? There are several: EXPORT, LOGIN/);
  assert.match(out, /Nothing was changed/);
  assert.match(runSlash('brick:approve', 'LOGIN-b1 EXPORT-b1', cwd), /NEEDS: which board\? You named different boards/);
  assert.equal(read(cwd, '.board/boards/EXPORT/tree.json') + read(cwd, '.board/boards/LOGIN/tree.json'), before);
});

test('typed commands accept nested ids with a key', async () => {
  const { cwd, dir } = await newProject('Login');
  const r = (...a) => run(cwd, ...a);
  r('add', 'box', 'One'); r('add', 'problem', 'A', '--parent', 'b1', '--input', 'i', '--output', 'o', '--check', 'c');
  r('add', 'problem', 'B', '--parent', 'p1', '--input', 'i', '--output', 'o', '--check', 'c');
  assert.equal(runSlash('brick:approve', 'LOGIN-p1.1', cwd), '[brick] approved LOGIN-p1.1');
  assert.equal(load(dir).nodes['p1.1'].status, 'approved');
});

test('session start names the boards; with several and none active it asks', () => {
  const cwd = two();
  const out = sessionStart(cwd, () => true);
  assert.match(out, /^Project: Export report \(board EXPORT\)\nBoards: EXPORT \(active\), LOGIN/);
  fs.rmSync(path.join(cwd, '.board/active'));
  const none = sessionStart(cwd, () => true);
  assert.match(none, /^Boards: EXPORT, LOGIN\nNo board is active/);
});

test('ls --all prints every board, each with its own key on its ids', () => {
  const cwd = two();
  const out = run(cwd, 'ls', '--all').stdout;
  assert.match(out, /Export report \[EXPORT\]\n {2}EXPORT-b1 {2}Write CSV[^\n]*\n\nLogin \[LOGIN\]\n {2}LOGIN-b1 {2}Check password/);
  assert.equal(active(cwd), 'EXPORT');
});

test('with several boards the AI must name the board on every ai command', () => {
  const cwd = two();
  const bare = run(cwd, 'ai', 'add', 'box', '--title', 'X', '--user-said', 'a step');
  assert.equal(bare.status, 1);
  assert.match(bare.stderr, /Name the board on every board ai command/);
  assert.equal(Object.keys(load(path.join(cwd, '.board/boards/EXPORT')).nodes).length, 1);
  assert.equal(run(cwd, 'ai', 'add', 'box', '--title', 'X', '--user-said', 'a step', '--board', 'EXPORT').stdout.trim(), 'added EXPORT-b2');
  const one = tmp();
  run(one, 'init', 'Login');
  assert.equal(run(one, 'ai', 'add', 'box', '--title', 'X', '--user-said', 'a step').status, 0, 'one board: no flag needed');
});
