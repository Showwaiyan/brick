import test from 'node:test';
import assert from 'node:assert/strict';
import { newBoard } from './helpers.mjs';
import { execute } from '../src/commands.mjs';
import { load, mutate } from '../src/store.mjs';
import { lintMissing } from '../src/rules.mjs';

const QUOTE = ['--user-said', 'first it checks the password'];

test('ai add records an ai-scribe node with the user\'s words', async () => {
  const dir = await newBoard();
  assert.equal(execute(dir, ['ai', 'add', 'box', '--title', 'Check password', ...QUOTE]), 'added b1');
  const n = load(dir).nodes.b1;
  assert.equal(n.source, 'ai-scribe');
  assert.equal(n.status, 'drafting');
  assert.deepEqual(n.said, ['first it checks the password']);
  assert.equal(load(dir).events[0].actor, 'ai');
});

test('ai add needs --user-said (present, non-empty, at most 400 characters)', async () => {
  const dir = await newBoard();
  assert.throws(() => execute(dir, ['ai', 'add', 'box', '--title', 'X']), /--user-said is required/);
  assert.throws(() => execute(dir, ['ai', 'add', 'box', '--title', 'X', '--user-said', '  ']), /--user-said is required/);
  assert.throws(() => execute(dir, ['ai', 'add', 'box', '--title', 'X', '--user-said', 'a'.repeat(401)]), /400/);
  execute(dir, ['ai', 'add', 'box', '--title', 'X', '--user-said', 'a'.repeat(400)]);
  assert.equal(Object.keys(load(dir).nodes).length, 1);
});

test('ai edit appends the quote and refuses approved nodes', async () => {
  const dir = await newBoard();
  execute(dir, ['ai', 'add', 'box', '--title', 'One', ...QUOTE]);
  execute(dir, ['ai', 'edit', 'b1', '--desc', 'checks it', '--user-said', 'and then compares hashes']);
  assert.deepEqual(load(dir).nodes.b1.said, ['first it checks the password', 'and then compares hashes']);
  assert.throws(() => execute(dir, ['ai', 'edit', 'b1', '--desc', 'x']), /--user-said is required/);
  execute(dir, ['approve', 'b1']);
  assert.throws(() => execute(dir, ['ai', 'edit', 'b1', '--desc', 'y', ...QUOTE]), /Reopen it first/);
});

test('ai project sets input and output from the user\'s words', async () => {
  const dir = await newBoard();
  execute(dir, ['ai', 'project', '--input', 'a', '--output', 'b', '--user-said', 'a goes in, b comes out']);
  assert.equal(load(dir).project.input, 'a');
  assert.throws(() => execute(dir, ['ai', 'project', '--input', 'a']), /--user-said is required/);
  assert.throws(() => execute(dir, ['ai', 'project', '--name', 'z', ...QUOTE]), /Usage: board ai project/);
});

test('the ai namespace has no approve, reopen, supersede, restore, resolve or dismiss', async () => {
  const dir = await newBoard();
  execute(dir, ['add', 'box', 'One']);
  for (const sub of ['approve', 'reopen', 'supersede', 'restore', 'resolve', 'dismiss', 'delete', 'render', '']) {
    assert.throws(() => execute(dir, ['ai', sub, 'b1']), /not an AI command/, sub);
  }
  assert.equal(load(dir).nodes.b1.status, 'drafting');
});

test('ask-first gate: no gap on a node without the user\'s content', async () => {
  const dir = await newBoard();
  execute(dir, ['ai', 'add', 'box', '--title', 'One', ...QUOTE]);
  mutate(dir, (d) => { d.nodes.b1.said = []; }); // an ai-scribe node with no quote
  const gap = ['ai', 'gap', 'b1', '--missing', 'Nothing says what happens on error.'];
  assert.throws(() => execute(dir, gap), /no content from the user yet\. Ask the user for their own attempt first/);
  mutate(dir, (d) => { d.nodes.b1.said = ['they said so']; });
  assert.equal(execute(dir, gap), 'raised b1.g1 on b1');
  assert.equal(load(dir).gaps['b1.g1'].status, 'open');
});

test('gaps are allowed on human nodes, refused on superseded ones', async () => {
  const dir = await newBoard();
  execute(dir, ['add', 'box', 'One']);
  execute(dir, ['ai', 'gap', 'b1', '--missing', 'Nothing defines the limits.', '--where', 'before b2']);
  assert.equal(load(dir).gaps['b1.g1'].where, 'before b2');
  execute(dir, ['supersede', 'b1', '--why', 'x']);
  assert.throws(() => execute(dir, ['ai', 'gap', 'b1', '--missing', 'Nothing defines the limits.']), /superseded/);
});

test('ai gap has no field for a fix', async () => {
  const dir = await newBoard();
  execute(dir, ['add', 'box', 'One']);
  assert.throws(() => execute(dir, ['ai', 'gap', 'b1', '--missing', 'Nothing defines X.', '--fix', 'do Y']), /Usage: board ai gap/);
});

test('lint: every pattern rejects', () => {
  const bad = [
    'You should handle the missing user case.', 'It should use a not-found response here.',
    'Consider adding a retry for this step.', 'Try a different order for these steps.',
    'Please use the cache for lookups here.', 'Needs to add a check for empty input.',
    'We need to implement the lookup first.', 'The fix is to validate it earlier.',
    'A solution is missing for login errors.', 'Instead, do the check before hashing.',
    'I suggest checking the length first.', 'I recommend a limit on attempts.',
  ];
  for (const t of bad) assert.throws(() => lintMissing(t), /State what is missing, not how to fill it/, t);
});

test('lint: the good examples pass and the bad example is rejected', () => {
  lintMissing('Nothing says what happens when the username does not exist.');
  lintMissing('Check password assumes a user record exists, but nothing guarantees it.');
  lintMissing('It is unclear what happens when the limit is reached.');
  assert.throws(() => lintMissing('You should add a not-found response.'), /not how to fill it/);
});

test('lint: length and single-line rules', () => {
  assert.throws(() => lintMissing('short'), /8 to 300/);
  assert.throws(() => lintMissing(undefined), /8 to 300/);
  assert.throws(() => lintMissing('x'.repeat(301)), /8 to 300/);
  assert.throws(() => lintMissing('Nothing defines X.\nNor Y.'), /single line/);
  lintMissing('x'.repeat(300));
});
