import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmp } from './helpers.mjs';
import { mergeHooks, HOOKS } from '../src/init.mjs';

const BIN = path.resolve('bin/board.mjs');
const board = (cwd, ...a) => spawnSync('node', [BIN, ...a], { cwd, encoding: 'utf8' });
const read = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');
const SKILL = path.resolve('templates/SKILL.md');

// A project folder with existing settings that must survive.
function withSettings() {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, '.claude'));
  const existing = {
    permissions: { allow: ['Bash(npm test)'] },
    model: 'sonnet',
    hooks: {
      PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo mine' }] }],
      Stop: [{ hooks: [{ type: 'command', command: 'echo stop' }] }],
    },
  };
  fs.writeFileSync(path.join(dir, '.claude/settings.json'), JSON.stringify(existing, null, 2));
  return { dir, existing };
}

test('init keeps every existing setting and hook and adds exactly our three', () => {
  const { dir, existing } = withSettings();
  const r = board(dir, 'init', 'X');
  assert.equal(r.status, 0, r.stderr);
  const after = JSON.parse(read(dir, '.claude/settings.json'));
  assert.deepEqual(after.permissions, existing.permissions);
  assert.equal(after.model, 'sonnet');
  assert.deepEqual(after.hooks.Stop, existing.hooks.Stop);
  assert.deepEqual(after.hooks.PreToolUse[0], existing.hooks.PreToolUse[0], 'existing entry first and untouched');
  assert.deepEqual(after.hooks.PreToolUse.slice(1), [
    { matcher: 'Bash', hooks: [{ type: 'command', command: 'board guard bash' }] },
    { matcher: 'Write|Edit|MultiEdit|NotebookEdit', hooks: [{ type: 'command', command: 'board guard write' }] },
  ]);
  assert.deepEqual(after.hooks.SessionStart, [{ hooks: [{ type: 'command', command: 'board guard session-start' }] }]);
  assert.equal(read(dir, '.claude/settings.json').endsWith('\n'), true);
});

test('running the setup again adds nothing and leaves tree.json alone', () => {
  const { dir } = withSettings();
  board(dir, 'init', 'X');
  const settings = read(dir, '.claude/settings.json');
  const tree = read(dir, '.board/tree.json');
  const r = board(dir, 'init', '--update');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(read(dir, '.claude/settings.json'), settings);
  assert.equal(read(dir, '.board/tree.json'), tree);
  assert.match(r.stdout, /already in \.claude\/settings\.json/);
  assert.equal(mergeHooks(JSON.parse(settings)), 0);
  assert.equal(HOOKS.length, 3);
});

test('invalid existing settings JSON stops init with no changes', () => {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, '.claude'));
  fs.writeFileSync(path.join(dir, '.claude/settings.json'), '{ "hooks": ');
  const r = board(dir, 'init', 'X');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /not valid JSON/);
  assert.equal(read(dir, '.claude/settings.json'), '{ "hooks": ');
  assert.deepEqual(fs.readdirSync(dir).sort(), ['.claude']);
});

test('a settings file with an unexpected shape is refused untouched', () => {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, '.claude'));
  fs.writeFileSync(path.join(dir, '.claude/settings.json'), '{"hooks": {"PreToolUse": "oops"}}');
  const r = board(dir, 'init', 'X');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /not a list/);
  assert.equal(read(dir, '.claude/settings.json'), '{"hooks": {"PreToolUse": "oops"}}');
});

test('.gitignore gets the .board/ line once, keeping what was there', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules');
  board(dir, 'init', 'X');
  board(dir, 'init', '--update');
  assert.equal(read(dir, '.gitignore'), 'node_modules\n.board/\n');
  const fresh = tmp();
  board(fresh, 'init', 'X');
  assert.equal(read(fresh, '.gitignore'), '.board/\n');
});

test('the skill is copied; a differing one is kept unless --update', () => {
  const dir = tmp();
  board(dir, 'init', 'X');
  const file = '.claude/skills/decompose/SKILL.md';
  assert.equal(read(dir, file), fs.readFileSync(SKILL, 'utf8'));
  fs.writeFileSync(path.join(dir, file), 'my own version');
  assert.equal(board(dir, 'init', '--update').status, 0);
  assert.equal(read(dir, file), fs.readFileSync(SKILL, 'utf8'), '--update replaces it');
});

test('without --update a differing skill is not overwritten, and init says so', () => {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, '.claude/skills/decompose'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude/skills/decompose/SKILL.md'), 'my own version');
  const r = board(dir, 'init', 'X');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /skill differs; run board init --update to replace it/);
  assert.equal(read(dir, '.claude/skills/decompose/SKILL.md'), 'my own version');
});

test('init reports the PATH check and the backup note; --update needs a board', () => {
  const dir = tmp();
  const r = board(dir, 'init', 'X');
  assert.match(r.stdout, /PATH: board found|WARNING: "board" is not on your PATH/);
  assert.match(r.stdout, /not back it up/);
  assert.match(board(tmp(), 'init', '--update').stderr, /No \.board\/ here/);
});
