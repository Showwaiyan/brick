import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmp } from './helpers.mjs';
import { sessionStart } from '../src/guard.mjs';

const BIN = path.resolve('bin/board.mjs');

// Runs `board guard <sub>` with a hook payload on stdin, like Claude Code does.
function guard(sub, payload, cwd = tmp()) {
  return spawnSync('node', [BIN, 'guard', sub], { input: JSON.stringify(payload), encoding: 'utf8', cwd });
}
const bash = (command) => guard('bash', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } });
const write = (file_path, tool_name = 'Write') => guard('write', { hook_event_name: 'PreToolUse', tool_name, tool_input: { file_path } });

test('guard bash: allowed commands', () => {
  for (const c of ['board ls', 'board ai gap b3 --missing "x"', 'cd x && board show b1', 'node /p/bin/board.mjs brief',
    'ls -la', 'git status', 'board ai add box --title x --user-said y', 'board ai edit b1 --user-said y --desc z',
    'board ai project --user-said y --input a', 'board log --last 5', 'echo "the dashboard is fine"']) {
    const r = bash(c);
    assert.equal(r.status, 0, `${c}: ${r.stderr}`);
  }
});

test('guard bash: blocked commands, with a message that says what to do', () => {
  for (const c of ['board approve p1', 'a && board supersede p1 --why x', 'echo $(board reopen p1)', 'board gap dismiss g1',
    'node /p/bin/board.mjs approve p1', 'cat .board/tree.json', 'sed -i s/a/b/ .board/tree.json', 'board init x',
    'board restore b1', 'board ai approve p1', 'board edit p1 --title x', 'ls; board gap resolve g1 --note x',
    'FOO=1 `board approve p1`', '(board approve p1)', 'bash -c "board approve p1"', '/usr/local/bin/board approve p1']) {
    const r = bash(c);
    assert.equal(r.status, 2, c);
    assert.ok(r.stderr.length > 0, c);
  }
  const slash = (cmd, want) => assert.match(bash(cmd).stderr, new RegExp(`human-only command\\. Ask the user to run: /brick:${want}`), cmd);
  slash('board approve p1', 'approve');
  slash('board reopen p1 --why x', 'reopen');
  slash('board supersede p1 --why x', 'supersede');
  slash('board restore p1', 'restore');
  slash('board init x', 'init');
  slash('board gap resolve g1 --note x', 'resolve');
  slash('board gap dismiss g1 --why x', 'dismiss');
  for (const w of ['add', 'edit', 'project']) {
    const err = bash(`board ${w} x`).stderr;
    assert.match(err, new RegExp(`board ai ${w}`), w);
    assert.match(err, /--user-said/, w);
  }
  assert.match(bash('board ai approve p1').stderr, /AI may only run: board ai add\|edit\|project\|gap/);
  assert.match(bash('cat .board/tree.json').stderr, /board show/);
});

test('guard write: blocks .board paths, allows others', () => {
  assert.equal(write('.board/tree.json').status, 2);
  assert.equal(write('/abs/proj/.board/x').status, 2);
  assert.equal(write('/abs/proj/.board/tree.html', 'Edit').status, 2);
  assert.match(write('.board/tree.json').stderr, /written only by the board command/);
  assert.equal(write('src/store.mjs').status, 0);
  assert.equal(write('/abs/proj/not.board/x').status, 0);
  const nb = guard('write', { tool_name: 'NotebookEdit', tool_input: { notebook_path: '/p/.board/n.ipynb' } });
  assert.equal(nb.status, 2);
});

test('guards let garbage input through instead of breaking the session', () => {
  const r = spawnSync('node', [BIN, 'guard', 'bash'], { input: 'not json', encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(guard('nonsense', {}).status, 0);
});

test('session-start: prints the brief when a board exists (and asks to open the page)', () => {
  const dir = tmp();
  spawnSync('node', [BIN, 'init', 'Proj'], { cwd: dir });
  const opened = [];
  const out = sessionStart(dir, (f) => { opened.push(f); return true; });
  assert.match(out, /^Project: Proj/);
  assert.equal(opened.length, 1);
  assert.match(opened[0], /tree\.html$/);
});

test('session-start: respects openBrowserOnSessionStart: false', () => {
  const dir = tmp();
  spawnSync('node', [BIN, 'init', 'Proj'], { cwd: dir });
  fs.writeFileSync(path.join(dir, '.board/config.json'), '{"openBrowserOnSessionStart": false}');
  const opened = [];
  assert.match(sessionStart(dir, (f) => opened.push(f)), /Project: Proj/);
  assert.equal(opened.length, 0);
  const r = guard('session-start', { hook_event_name: 'SessionStart', cwd: dir });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Project: Proj/);
});

test('session-start: prints nothing without a board, and exits 0 on a corrupt tree.json', () => {
  const dir = tmp();
  const none = guard('session-start', { cwd: dir }, dir);
  assert.equal(none.status, 0);
  assert.equal(none.stdout, '');
  spawnSync('node', [BIN, 'init', 'Proj'], { cwd: dir });
  fs.writeFileSync(path.join(dir, '.board/config.json'), '{"openBrowserOnSessionStart": false}');
  fs.writeFileSync(path.join(dir, '.board/tree.json'), '{ broken');
  const bad = guard('session-start', { cwd: dir }, dir);
  assert.equal(bad.status, 0);
  assert.equal(bad.stdout, '');
});

// A board in a fresh folder with one complete box b1; returns the folder.
function boardDir() {
  const dir = tmp();
  spawnSync('node', [BIN, 'init', 'Proj'], { cwd: dir });
  fs.writeFileSync(path.join(dir, '.board/config.json'), '{"openBrowserOnSessionStart": false}');
  spawnSync('node', [BIN, 'add', 'box', 'One'], { cwd: dir });
  return dir;
}
const prompt = (command_name, command_args, cwd) =>
  guard('prompt', { hook_event_name: 'UserPromptExpansion', expansion_type: 'slash_command', command_name, command_args, cwd }, cwd);

test('guard prompt: a typed /brick:approve runs the action and prints the result', () => {
  const dir = boardDir();
  const r = prompt('brick:approve', 'b1', dir);
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), '[brick] approved b1');
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, '.board/tree.json'), 'utf8')).nodes.b1.status, 'approved');
});

test('guard prompt: other commands, bad input and empty payloads are silent', () => {
  const dir = boardDir();
  for (const name of ['approve', 'other:approve', 'brick:decompose']) {
    const r = prompt(name, 'b1', dir);
    assert.equal(r.status, 0, name);
    assert.equal(r.stdout, '', name);
  }
  assert.equal(guard('prompt', {}, dir).stdout, '');
  const bad = spawnSync('node', [BIN, 'guard', 'prompt'], { input: 'not json', encoding: 'utf8', cwd: dir });
  assert.equal(bad.status, 0);
  assert.equal(bad.stdout, '');
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, '.board/tree.json'), 'utf8')).nodes.b1.status, 'drafting');
});

test('guard prompt: with no board it says to run /brick:init', () => {
  const dir = tmp();
  const r = prompt('brick:approve', 'b1', dir);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /\/brick:init/);
});
