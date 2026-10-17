import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmp, newBoard } from './helpers.mjs';
import { execute } from '../src/commands.mjs';
import { load } from '../src/store.mjs';
import { tokenize, runSlash } from '../src/slash.mjs';

// A board with two boxes, returned with its project folder.
async function setup() {
  const dir = await newBoard();
  execute(dir, ['add', 'box', 'One']);
  execute(dir, ['add', 'box', 'Two']);
  return { dir, cwd: path.dirname(dir) };
}

test('tokenize splits like a shell would, without a shell', () => {
  assert.deepEqual(tokenize('p3'), ['p3']);
  assert.deepEqual(tokenize('p3 --why "not needed, sorry"'), ['p3', '--why', 'not needed, sorry']);
  assert.deepEqual(tokenize("p3 --why 'two words'"), ['p3', '--why', 'two words']);
  assert.deepEqual(tokenize('--why ""'), ['--why', '']);
  assert.deepEqual(tokenize('--why "say \\"hi\\""'), ['--why', 'say "hi"']);
  assert.deepEqual(tokenize('  a \n  b\t\tc  '), ['a', 'b', 'c']);
  assert.deepEqual(tokenize(''), []);
  assert.throws(() => tokenize('--why "oops'), /unterminated/i);
});

test('each slash command maps to its engine action', async () => {
  const { dir, cwd } = await setup();
  assert.equal(runSlash('brick:approve', 'b1', cwd), '[brick] approved b1');
  assert.equal(load(dir).nodes.b1.status, 'approved');
  assert.equal(runSlash('brick:reopen', 'b1 --why "changed my mind"', cwd), '[brick] reopened b1');
  execute(dir, ['ai', 'gap', 'b1', '--missing', 'Nothing defines the thing.']);
  execute(dir, ['ai', 'gap', 'b1', '--missing', 'It is unclear what happens on error.']);
  assert.match(runSlash('brick:resolve', 'g1 --note "ok"', cwd), /^\[brick\] resolved g1/);
  assert.match(runSlash('brick:dismiss', 'g2 --why "no"', cwd), /^\[brick\] dismissed g2/);
  assert.match(runSlash('brick:supersede', 'b1 --why "x" --by b2', cwd), /^\[brick\] superseded b1/);
  assert.match(runSlash('brick:restore', 'b1', cwd), /^\[brick\] restored b1/);
  assert.equal(load(dir).nodes.b1.status, 'drafting');
});

test('init creates the board in an empty folder', () => {
  const cwd = tmp();
  const out = runSlash('brick:init', '"My project" --input a', cwd);
  assert.match(out, /^\[brick\] created/);
  const d = load(path.join(cwd, '.board'));
  assert.equal(d.project.name, 'My project');
  assert.equal(d.project.input, 'a');
});

test('a refused action returns its reason and does not throw', async () => {
  const { cwd } = await setup();
  execute(path.join(cwd, '.board'), ['ai', 'gap', 'b1', '--missing', 'Nothing defines the thing.']);
  const out = runSlash('brick:approve', 'b1', cwd);
  assert.match(out, /^\[brick\] .*open gaps/s);
});

test('Review Focus: shell syntax in arguments stays literal text', async () => {
  const { dir, cwd } = await setup();
  runSlash('brick:approve', 'b1', cwd);
  const mark = path.join(tmp(), 'created-by-shell');
  const why = `$(touch ${mark}) ; \`id\``;
  assert.match(runSlash('brick:reopen', `b1 --why "${why}"`, cwd), /^\[brick\] reopened b1/);
  assert.equal(fs.existsSync(mark), false);
  assert.equal(load(dir).events.at(-1).detail.why, why);
});

test('Review Focus: missing id, no board, and a corrupt tree.json', async () => {
  assert.match(runSlash('brick:approve', '', (await setup()).cwd), /Usage: board approve <id>/);
  const empty = tmp();
  const none = runSlash('brick:approve', 'p3', empty);
  assert.match(none, /^\[brick\] No \.board\/ here\. Run: \/brick:init/);
  const { dir, cwd } = await setup();
  fs.writeFileSync(path.join(dir, 'tree.json'), '{ broken');
  const bad = runSlash('brick:approve', 'b1', cwd);
  assert.match(bad, /^\[brick\] /);
});

test('commands that are not ours are ignored silently', async () => {
  const { cwd } = await setup();
  for (const name of ['approve', 'other:approve', 'brick:decompose', 'brick:nope', '', undefined]) {
    assert.equal(runSlash(name, 'b1', cwd), '', String(name));
  }
});
