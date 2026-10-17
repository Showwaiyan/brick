import test from 'node:test';
import assert from 'node:assert/strict';
import { newBoard } from './helpers.mjs';
import { execute } from '../src/commands.mjs';
import { load, mutate } from '../src/store.mjs';
import { raiseGap } from '../src/rules.mjs';
import { parseRequest } from '../src/refer.mjs';

// b1 Validate input, b2 Look up user, b3 Check password (p1 Compare password hash, p2 Rate limit attempts), b4 Sign in with Google.
async function board() {
  const dir = await newBoard();
  const x = (...a) => execute(dir, a);
  for (const t of ['Validate input', 'Look up user', 'Check password', 'Sign in with Google']) x('add', 'box', t);
  x('add', 'problem', 'Compare password hash', '--parent', 'b3');
  x('add', 'problem', 'Rate limit attempts', '--parent', 'b3');
  const gap = (node) => mutate(dir, (d) => raiseGap(d, 'ai', node, 'Nothing defines the thing.', null, 'now'));
  return { dir, x, gap, data: () => load(dir) };
}
const ask = async (verb, text, setup) => {
  const b = await board();
  if (setup) setup(b);
  return parseRequest(b.data(), verb, text);
};

test('approve: id, id in any case, title, and a leading "the"', async () => {
  assert.deepEqual(await ask('approve', 'b3'), { argv: ['approve', 'b3'] });
  assert.deepEqual(await ask('approve', 'B3 please'), { argv: ['approve', 'b3'] });
  assert.deepEqual(await ask('approve', 'check password'), { argv: ['approve', 'b3'] });
  assert.deepEqual(await ask('approve', 'the Check Password step'), { argv: ['approve', 'b3'] });
  assert.deepEqual(await ask('approve', 'compare password hash'), { argv: ['approve', 'p1'] });
});

test('approve: unknown, empty and ambiguous input asks instead of guessing', async () => {
  const unknown = await ask('approve', 'frobnicate');
  assert.match(unknown.needs, /^NEEDS: which node/);
  assert.match(unknown.needs, /b1 Validate input/);
  assert.match(unknown.needs, /Nothing was changed/);
  assert.match((await ask('approve', 'b99')).needs, /no node "b99"/i);
  assert.match((await ask('approve', '')).needs, /^NEEDS: which node/);
  const dup = await ask('approve', 'same', ({ x }) => { x('add', 'box', 'Same'); x('add', 'box', 'Same'); });
  assert.match(dup.needs, /Several nodes are titled "Same": b5, b6/);
  assert.match(dup.needs, /\/brick:approve b5/);
});

test('reopen: the reason is the rest of the text, and it is required', async () => {
  const ok = ({ x }) => x('approve', 'b1');
  assert.deepEqual(await ask('reopen', 'b1 I changed my mind', ok), { argv: ['reopen', 'b1', '--why=I changed my mind'] });
  assert.deepEqual(await ask('reopen', 'b1 because the order was wrong', ok), { argv: ['reopen', 'b1', '--why=the order was wrong'] });
  assert.deepEqual(await ask('reopen', 'b1: since it grew', ok), { argv: ['reopen', 'b1', '--why=it grew'] });
  assert.deepEqual(await ask('reopen', 'validate input because b2 is broken', ok), { argv: ['reopen', 'b1', '--why=b2 is broken'] });
  const none = await ask('reopen', 'b1', ok);
  assert.match(none.needs, /^NEEDS: a reason for reopening b1 \(Validate input\)/);
  assert.match(none.needs, /Complete command: \/brick:reopen b1 <your reason>/);
});

test('supersede: reason, "replaced by", and reasons that look like flags', async () => {
  assert.deepEqual(await ask('supersede', 'b4 the client only needs a password'),
    { argv: ['supersede', 'b4', '--why=the client only needs a password'] });
  assert.deepEqual(await ask('supersede', 'b4 replaced by b2, dropped OAuth'),
    { argv: ['supersede', 'b4', '--why=dropped OAuth', '--by=b2'] });
  assert.deepEqual(await ask('supersede', 'sign in with google --force'), { argv: ['supersede', 'b4', '--why=--force'] });
  assert.match((await ask('supersede', 'b4')).needs, /a reason for superseding b4/);
  assert.match((await ask('supersede', 'b4 replaced by b2')).needs, /a reason for superseding b4/);
});

test('restore: finds directly superseded nodes by id or title', async () => {
  const gone = ({ x }) => x('supersede', 'b4', '--why', 'no');
  assert.deepEqual(await ask('restore', 'b4', gone), { argv: ['restore', 'b4'] });
  assert.deepEqual(await ask('restore', 'sign in with google', gone), { argv: ['restore', 'b4'] });
  assert.match((await ask('restore', 'check password', gone)).needs, /^NEEDS: which node/);
});

test('resolve and dismiss: a gap id, or a node title with exactly one open gap', async () => {
  const one = ({ gap }) => gap('b3');
  assert.deepEqual(await ask('resolve', 'g1 handled in the hash step', one), { argv: ['gap', 'resolve', 'g1', '--note=handled in the hash step'] });
  assert.deepEqual(await ask('dismiss', 'check password not a real gap', one), { argv: ['gap', 'dismiss', 'g1', '--why=not a real gap'] });
  assert.match((await ask('dismiss', 'g1', one)).needs, /a reason for dismissing g1/);
  assert.match((await ask('resolve', 'g1', one)).needs, /a note for resolving g1/);
  const two = await ask('dismiss', 'check password not real', ({ gap }) => { gap('b3'); gap('b3'); });
  assert.match(two.needs, /g1 .*g2/s);
  assert.match((await ask('dismiss', 'validate input nope', one)).needs, /no open gaps|which gap/i);
});
