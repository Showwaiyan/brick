import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmp, git, gitRepo } from './helpers.mjs';

const BIN = path.resolve('bin/board.mjs');
const board = (cwd, ...a) => spawnSync('node', [BIN, ...a], { cwd, encoding: 'utf8' });
const read = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');

test('.gitignore gets the .board/ line once and keeps what was there', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules');
  const r = board(dir, 'init', 'X');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(read(dir, '.gitignore'), 'node_modules\n.board/\n');
  assert.equal(board(dir, 'init', 'X').status, 0, 'a second board is allowed');
  assert.equal(read(dir, '.gitignore'), 'node_modules\n.board/\n');
  const fresh = tmp();
  board(fresh, 'init', 'X');
  assert.equal(read(fresh, '.gitignore'), '.board/\n');
});

test('init creates the board and config, and nothing under .claude/', () => {
  const dir = tmp();
  const r = board(dir, 'init', 'Xyz', '--input', 'a');
  assert.match(r.stdout, /created board XYZ .*\.board/);
  assert.match(r.stdout, /XYZ-b1/);
  assert.match(r.stdout, /not back it up/);
  assert.ok(fs.existsSync(path.join(dir, '.board/boards/XYZ/tree.json')));
  assert.ok(fs.existsSync(path.join(dir, '.board/boards/XYZ/tree.html')));
  assert.equal(read(dir, '.board/active').trim(), 'XYZ');
  assert.deepEqual(JSON.parse(read(dir, '.board/config.json')), { openBrowserOnSessionStart: true });
  assert.equal(fs.existsSync(path.join(dir, '.claude')), false);
});

test('a second init makes a second board and makes it active; a taken --key is refused', () => {
  const dir = tmp();
  board(dir, 'init', 'Login');
  const r = board(dir, 'init', 'Export report');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(dir, '.board/boards/EXPORT/tree.json')));
  assert.equal(read(dir, '.board/active').trim(), 'EXPORT');
  assert.match(board(dir, 'init', 'Other', '--key', 'LOGIN').stderr, /already exists/);
  assert.match(board(dir, 'init', 'Other', '--key', 'bad key').stderr, /not a board key/);
  assert.equal(board(dir, 'init', 'Other', '--key', 'oth').status, 0, 'keys are upper-cased');
  assert.ok(fs.existsSync(path.join(dir, '.board/boards/OTH/tree.json')));
});

test('init refuses in a linked worktree', () => {
  const root = gitRepo();
  const wt = path.join(tmp(), 'wt');
  git(root, 'worktree', 'add', '-q', wt, '-b', 'feat');
  const r = board(wt, 'init', 'X');
  assert.equal(r.status, 1);
  assert.ok(r.stderr.includes(`Run board init in the main checkout: ${root}`));
  assert.equal(fs.existsSync(path.join(wt, '.board')), false);
});

test('--update is gone, and a name is required', () => {
  assert.match(board(tmp(), 'init', '--update').stderr, /Unknown option/);
  assert.match(board(tmp(), 'init').stderr, /Usage: board init/);
});
