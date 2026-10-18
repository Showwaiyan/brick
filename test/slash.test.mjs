import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmp, newBoard, gitRepo, git } from './helpers.mjs';
import { execute } from '../src/commands.mjs';
import { load } from '../src/store.mjs';
import { runSlash } from '../src/slash.mjs';

// A board with boxes b1 One, b2 Two; returns the data folder and the project folder.
async function setup() {
  const dir = await newBoard();
  execute(dir, ['add', 'box', 'One']);
  execute(dir, ['add', 'box', 'Two']);
  return { dir, cwd: path.dirname(dir) };
}

test('each command works in plain words', async () => {
  const { dir, cwd } = await setup();
  assert.equal(runSlash('brick:approve', 'one', cwd), '[brick] approved b1');
  assert.equal(load(dir).nodes.b1.status, 'approved');
  assert.equal(runSlash('brick:reopen', 'b1 I changed my mind', cwd), '[brick] reopened b1');
  execute(dir, ['ai', 'gap', 'b1', '--missing', 'Nothing defines the thing.']);
  execute(dir, ['ai', 'gap', 'b2', '--missing', 'It is unclear what happens on error.']);
  assert.match(runSlash('brick:resolve', 'b1.g1 handled in the next step', cwd), /^\[brick\] resolved b1\.g1/);
  assert.match(runSlash('brick:dismiss', 'two is not a real gap', cwd), /^\[brick\] dismissed b2\.g1/);
  assert.match(runSlash('brick:supersede', 'b1 replaced by b2, the client dropped it', cwd), /^\[brick\] superseded b1/);
  const d = load(dir);
  assert.equal(d.nodes.b1.superseded.by, 'b2');
  assert.equal(d.nodes.b1.superseded.reason, 'the client dropped it');
  assert.equal(d.gaps['b1.g1'].note, 'handled in the next step');
  assert.match(runSlash('brick:restore', 'one', cwd), /^\[brick\] restored b1/);
});

test('init: the whole text is the project name; no flags needed', () => {
  const cwd = tmp();
  const out = runSlash('brick:init', 'login feature for my app', cwd);
  assert.match(out, /^\[brick\] created/);
  assert.equal(load(path.join(cwd, '.board')).project.name, 'login feature for my app');
  const flagLike = tmp();
  runSlash('brick:init', '--demo', flagLike);
  assert.equal(load(path.join(flagLike, '.board')).project.name, '--demo');
  assert.equal(Object.keys(load(path.join(flagLike, '.board')).nodes).length, 0, 'no demo data');
});

test('init with no words asks for a name and creates nothing', () => {
  const cwd = tmp();
  assert.match(runSlash('brick:init', '  ', cwd), /^\[brick\] NEEDS: a name for the project/);
  assert.equal(fs.existsSync(path.join(cwd, '.board')), false);
});

test('the command name is matched case-insensitively', () => {
  const cwd = tmp();
  assert.match(runSlash('brick:Init', 'My app', cwd), /^\[brick\] created/);
  assert.match(runSlash('BRICK:OPEN-NOT', '', cwd), /^$/);
});

test('incomplete input changes nothing and asks', async () => {
  const { dir, cwd } = await setup();
  runSlash('brick:approve', 'b1', cwd);
  const before = fs.readFileSync(path.join(dir, 'tree.json'), 'utf8');
  const out = runSlash('brick:reopen', 'b1', cwd);
  assert.match(out, /^\[brick\] NEEDS: a reason for reopening b1/);
  assert.match(out, /Complete command: \/brick:reopen b1 <your reason>/);
  assert.equal(fs.readFileSync(path.join(dir, 'tree.json'), 'utf8'), before);
});

test('a refused action returns its reason and does not throw', async () => {
  const { dir, cwd } = await setup();
  execute(dir, ['ai', 'gap', 'b1', '--missing', 'Nothing defines the thing.']);
  assert.match(runSlash('brick:approve', 'b1', cwd), /^\[brick\] .*open gaps/s);
});

test('Review Focus: shell syntax in the reason stays literal text', async () => {
  const { dir, cwd } = await setup();
  runSlash('brick:approve', 'b1', cwd);
  const mark = path.join(tmp(), 'created-by-shell');
  const why = `$(touch ${mark}) ; \`id\` "quoted" 'single'`;
  assert.match(runSlash('brick:reopen', `b1 because ${why}`, cwd), /^\[brick\] reopened b1/);
  assert.equal(fs.existsSync(mark), false);
  assert.equal(load(dir).events.at(-1).detail.why, why);
});

test('Review Focus: no board, a corrupt tree.json, and an unknown node', async () => {
  assert.match(runSlash('brick:approve', 'b1', tmp()), /^\[brick\] No \.board\/ here\. Run: \/brick:init/);
  const { dir, cwd } = await setup();
  fs.writeFileSync(path.join(dir, 'tree.json'), '{ broken');
  assert.match(runSlash('brick:approve', 'b1', cwd), /^\[brick\] /);
  assert.match(runSlash('brick:approve', 'zz', (await setup()).cwd), /^\[brick\] NEEDS: which node/);
});

test('commands that are not ours are ignored silently', async () => {
  const { cwd } = await setup();
  for (const name of ['approve', 'other:approve', 'brick:decompose', 'brick:nope', '', undefined]) {
    assert.equal(runSlash(name, 'b1', cwd), '', String(name));
  }
});

test('init in a linked worktree points at /brick:init', () => {
  const root = gitRepo();
  const wtDir = path.join(tmp(), 'wt');
  git(root, 'worktree', 'add', '-q', wtDir, '-b', 'feat');
  assert.match(runSlash('brick:init', 'X', wtDir), /Run \/brick:init in the main checkout/);
});
