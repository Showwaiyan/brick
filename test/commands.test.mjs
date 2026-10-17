import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmp, git, gitRepo, newBoard } from './helpers.mjs';
import { execute } from '../src/commands.mjs';

const BIN = path.resolve('bin/board.mjs');
const cli = (cwd, ...a) => spawnSync('node', [BIN, ...a], { cwd, encoding: 'utf8' });

test('init creates the data folder and config; refuses a second time', () => {
  const dir = tmp();
  const r = cli(dir, 'init', 'Demo', '--input', 'a', '--output', 'b');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(dir, '.board/tree.json')));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, '.board/config.json'), 'utf8')), { openBrowserOnSessionStart: true });
  const again = cli(dir, 'init', 'Demo');
  assert.equal(again.status, 1);
  assert.match(again.stderr, /already exists/);
});

test('init refuses inside a linked worktree', () => {
  const root = gitRepo();
  const wt = path.join(tmp(), 'wt');
  git(root, 'worktree', 'add', '-q', wt, '-b', 'feat');
  const r = cli(wt, 'init', 'X');
  assert.equal(r.status, 1);
  assert.ok(r.stderr.includes(`Run board init in the main checkout: ${root}`));
  assert.ok(!fs.existsSync(path.join(wt, '.board')));
});

test('commands outside a project fail with a hint; unknown command fails', () => {
  const dir = tmp();
  assert.match(cli(dir, 'ls').stderr, /No \.board\/ here\. Run: board init/);
  assert.match(cli(dir, 'nope').stderr, /Unknown command "nope"/);
  assert.equal(cli(dir, 'help').status, 0);
  assert.ok(!cli(dir, 'help').stdout.includes('guard'));
});

test('ls, show, log and brief print what they should', async () => {
  const dir = await newBoard('Proj');
  const x = (...a) => execute(dir, a);
  x('add', 'box', 'One'); x('add', 'problem', 'Leaf', '--parent', 'b1');
  assert.match(x('ls'), /Proj\n  b1  One  \[drafting\]\n    p1  Leaf  \[drafting\]/);
  assert.match(x('show', 'p1'), /contract:\n {2}input: not set[\s\S]*next commands:\n {2}\/brick:approve p1/);
  assert.match(x('log', '--last', '1'), /^#2 .* human add p1/);
  assert.equal(x('brief').split('\n').length, 5);
  assert.throws(() => x('show', 'zz'), /no node "zz"/);
  assert.throws(() => x('log', '--last', '0'), /whole number/);
});

test('unknown flags and missing arguments give a usage line', async () => {
  const dir = await newBoard();
  assert.throws(() => execute(dir, ['approve']), /Usage: board approve <id>/);
  assert.throws(() => execute(dir, ['add', 'box', 'X', '--bogus', '1']), /Usage: board add/);
  assert.throws(() => execute(dir, ['project']), /Nothing to change/);
});
