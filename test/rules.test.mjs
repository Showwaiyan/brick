import test from 'node:test';
import assert from 'node:assert/strict';
import { newBoard } from './helpers.mjs';
import { execute } from '../src/commands.mjs';
import { load, mutate } from '../src/store.mjs';
import { raiseGap } from '../src/rules.mjs';

const LEAF = ['--input', 'i', '--output', 'o', '--check', 'c'];

// Board: b1 > (p1, p2 complete leaves), b2. Returns the folder and a command runner.
async function setup() {
  const dir = await newBoard();
  const x = (...a) => execute(dir, a);
  x('add', 'box', 'One'); x('add', 'box', 'Two');
  x('add', 'problem', 'Leaf A', '--parent', 'b1', ...LEAF);
  x('add', 'problem', 'Leaf B', '--parent', 'b1', ...LEAF);
  const gap = (node, text = 'Nothing defines the thing.') => mutate(dir, (d) => raiseGap(d, 'ai', node, text, null, 'now'));
  return { dir, x, gap };
}

test('approve refuses: open gap, unapproved child, leaf missing check, not drafting', async () => {
  const { x, gap } = await setup();
  x('add', 'problem', 'NoCheck', '--parent', 'b2', '--input', 'i', '--output', 'o');
  assert.throws(() => x('approve', 'p3'), /needs: check/);
  assert.throws(() => x('approve', 'b1'), /not approved yet: p1, p2/);
  x('approve', 'p1');
  assert.throws(() => x('approve', 'p1'), /is approved, not drafting/);
  gap('p2');
  assert.throws(() => x('approve', 'p2'), /open gaps[\s\S]*g1/);
  x('gap', 'resolve', 'g1', '--note', 'handled');
  x('approve', 'p2');
  assert.equal(x('approve', 'b1'), 'approved b1');
});

test('a box with no children can be approved with just a title', async () => {
  const { x } = await setup();
  assert.equal(x('approve', 'b2'), 'approved b2');
});

test('reopen needs --why and an approved node', async () => {
  const { x } = await setup();
  x('approve', 'p1');
  assert.throws(() => x('reopen', 'p1'), /--why is required/);
  assert.equal(x('reopen', 'p1', '--why', 'changed my mind'), 'reopened p1');
  assert.throws(() => x('reopen', 'p1', '--why', 'again'), /only an approved node/);
});

test('edit refuses approved and superseded nodes, accepts drafting ones', async () => {
  const { x } = await setup();
  x('approve', 'p1');
  assert.throws(() => x('edit', 'p1', '--title', 'New'), /Reopen it first/);
  x('supersede', 'b2', '--why', 'no');
  assert.throws(() => x('edit', 'b2', '--title', 'New'), /superseded/);
  assert.match(x('edit', 'b1', '--title', 'Uno'), /edited b1/);
});

test('supersede cascades, dismisses gaps, and says nothing was undone', async () => {
  const { dir, x, gap } = await setup();
  gap('p2');
  const out = x('supersede', 'b1', '--why', 'wrong approach');
  assert.match(out, /superseded b1, p1, p2/);
  assert.match(out, /Nothing built from these has been undone/);
  const d = load(dir);
  assert.equal(d.nodes.p1.superseded.cascade_from, 'b1');
  assert.equal(d.nodes.p1.superseded.reason, 'parent b1 superseded');
  assert.equal(d.nodes.b1.superseded.reason, 'wrong approach');
  assert.equal(d.gaps.g1.status, 'dismissed');
  assert.equal(d.gaps.g1.note, 'node superseded');
});

test('superseding a child reopens an approved parent', async () => {
  const { dir, x } = await setup();
  x('approve', 'p1'); x('approve', 'p2'); x('approve', 'b1');
  x('supersede', 'p1', '--why', 'not needed');
  assert.equal(load(dir).nodes.b1.status, 'drafting');
  assert.ok(load(dir).events.some((e) => e.action === 'reopen' && e.target === 'b1'));
});

test('supersede input checks: empty --why, bad --by, twice', async () => {
  const { x } = await setup();
  assert.throws(() => x('supersede', 'b2', '--why', ' '), /--why is required/);
  assert.throws(() => x('supersede', 'b2'), /--why is required/);
  assert.throws(() => x('supersede', 'b2', '--why', 'x', '--by', 'p1'), /is a problem, but b2 is a box/);
  assert.throws(() => x('supersede', 'b2', '--why', 'x', '--by', 'zz'), /no node "zz"/);
  x('supersede', 'b2', '--why', 'x', '--by', 'b1');
  assert.throws(() => x('supersede', 'b2', '--why', 'again'), /already superseded/);
  assert.throws(() => x('supersede', 'b1', '--why', 'x', '--by', 'b2'), /is superseded/);
});

test('restore works for direct supersedes only, and returns nodes as drafting', async () => {
  const { dir, x } = await setup();
  x('approve', 'p1');
  x('supersede', 'b1', '--why', 'oops');
  assert.throws(() => x('restore', 'p1'), /Restore that one instead: \/brick:restore b1/);
  assert.match(x('restore', 'b1'), /restored b1, p1, p2 \(as drafting\)/);
  const d = load(dir);
  assert.equal(d.nodes.p1.status, 'drafting');
  assert.equal(d.nodes.p1.superseded, null);
  assert.throws(() => x('restore', 'b1'), /not superseded/);
});

test('restore refuses when the parent is superseded', async () => {
  const { x } = await setup();
  x('supersede', 'p1', '--why', 'a');
  x('supersede', 'b1', '--why', 'b');
  assert.throws(() => x('restore', 'p1'), /parent b1 is superseded/);
});

test('ids are never reused after a supersede; --after renumbers siblings', async () => {
  const { dir, x } = await setup();
  x('supersede', 'b2', '--why', 'x');
  x('add', 'box', 'Three', '--after', 'b1');
  const d = load(dir);
  assert.ok(d.nodes.b3);
  assert.deepEqual(['b1', 'b3', 'b2'].map((id) => d.nodes[id].order), [1, 2, 3]);
});

test('add refuses a parent that is approved or superseded, and bad shapes', async () => {
  const { x } = await setup();
  x('approve', 'b2');
  assert.throws(() => x('add', 'problem', 'X', '--parent', 'b2'), /is approved/);
  assert.throws(() => x('add', 'problem', 'X'), /needs --parent/);
  assert.throws(() => x('add', 'box', 'X', '--parent', 'b1'), /Boxes have no parent/);
  assert.throws(() => x('add', 'thing', 'X'), /"box" or "problem"/);
  assert.throws(() => x('add', 'box', ' '), /title is required/);
});

test('gap resolve and dismiss need their text and an open gap', async () => {
  const { x, gap } = await setup();
  gap('b1');
  assert.throws(() => x('gap', 'resolve', 'g1'), /--note is required/);
  assert.throws(() => x('gap', 'dismiss', 'g1'), /--why is required/);
  assert.equal(x('gap', 'dismiss', 'g1', '--why', 'not real'), 'dismissed g1');
  assert.throws(() => x('gap', 'resolve', 'g1', '--note', 'x'), /already dismissed/);
});
