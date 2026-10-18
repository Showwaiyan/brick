import test from 'node:test';
import assert from 'node:assert/strict';
import { sample, node, newBoard } from './helpers.mjs';
import { nodeSignals, boardSignals, checkText, LIMITS } from '../src/signals.mjs';
import { execute } from '../src/commands.mjs';
import { load } from '../src/store.mjs';
import { checkBash } from '../src/guard.mjs';

const find = (list, key) => list.find((s) => s.key === key);
const FULL = { input: 'a name', output: 'a user', check: 'user found', limits: null };

test('a leaf with no contract is flagged, and says which fields', () => {
  const d = sample();
  const s = find(nodeSignals(d, 'p2'), 'contract');
  assert.equal(s.flag, true);
  assert.match(s.text, /input, output, check not set/);
  d.nodes.p2.contract = { ...FULL };
  const t = find(nodeSignals(d, 'p2'), 'contract');
  assert.equal(t.flag, false);
  assert.match(t.text, /input, output, check set/);
});

test('a node with sub-problems is not flagged for a missing contract', () => {
  const s = find(nodeSignals(sample(), 'b1'), 'contract');
  assert.equal(s.flag, false);
  assert.match(s.text, /has sub-problems/);
});

test('a title that joins two things is flagged; a plain title is not', () => {
  const d = sample();
  d.nodes.p2.title = 'Hash the password and rate-limit attempts';
  assert.equal(find(nodeSignals(d, 'p2'), 'purpose').flag, true);
  d.nodes.p2.title = 'Hash the password';
  assert.equal(find(nodeSignals(d, 'p2'), 'purpose').flag, false);
  d.nodes.p2.title = 'Brand name';
  assert.equal(find(nodeSignals(d, 'p2'), 'purpose').flag, false, '"and" inside a word is not a join');
});

test('children, siblings, depth and open gaps are reported', () => {
  const d = sample();
  assert.match(find(nodeSignals(d, 'b1'), 'children').text, /2 active \(p1 approved, p2 has gaps\)/);
  assert.match(find(nodeSignals(d, 'p2'), 'siblings').text, /2 at this level/);
  assert.match(find(nodeSignals(d, 'p2'), 'depth').text, /2/);
  const g = find(nodeSignals(d, 'p2'), 'gaps');
  assert.equal(g.flag, true);
  assert.match(g.text, /1 \(g1\)/);
  assert.equal(find(nodeSignals(d, 'b2'), 'gaps').flag, false);
});

test('too many siblings and too deep are flagged', () => {
  const d = sample();
  for (let i = 3; i <= LIMITS.siblingsMax + 2; i += 1) d.nodes[`p${i}`] = node(`p${i}`, { parent: 'b1', order: i });
  assert.equal(find(nodeSignals(d, 'p2'), 'siblings').flag, true);
  const e = sample();
  let parent = 'p2';
  for (let i = 3; i <= LIMITS.depthMax + 1; i += 1) { e.nodes[`p${i}`] = node(`p${i}`, { parent }); parent = `p${i}`; }
  assert.equal(find(nodeSignals(e, parent), 'depth').flag, true);
});

test('an AI draft that is not approved is flagged', () => {
  const d = sample();
  d.nodes.p2.source = 'ai-draft';
  d.nodes.p2.said = ['break it down for me'];
  const s = find(nodeSignals(d, 'p2'), 'draft');
  assert.equal(s.flag, true);
  assert.match(s.text, /AI draft/);
  d.nodes.p2.status = 'approved';
  assert.equal(find(nodeSignals(d, 'p2'), 'draft'), undefined);
});

test('a superseded node has nothing to check', () => {
  const d = sample();
  d.nodes.p1.status = 'superseded';
  d.nodes.p1.superseded = { reason: 'r', by: null, cascade_from: null, at: 'x' };
  const list = nodeSignals(d, 'p1');
  assert.equal(list.length, 1);
  assert.match(list[0].text, /superseded/);
});

test('board signals: top-level count, depth, leaves without a contract, gaps, drafts', () => {
  const d = sample();
  d.nodes.p1.source = 'ai-draft';
  d.nodes.p1.status = 'drafting';
  const list = boardSignals(d);
  assert.match(find(list, 'top').text, /2 boxes/);
  assert.equal(find(list, 'top').flag, true, 'fewer than the guide of 3');
  assert.match(find(list, 'depth').text, /2/);
  assert.match(find(list, 'contracts').text, /p1, p2/);
  assert.match(find(list, 'gaps').text, /p2 \(1\)/);
  assert.match(find(list, 'drafts').text, /p1/);
});

test('checkText is plain lines and never uses the forbidden words', () => {
  const d = sample();
  d.nodes.p2.title = 'Hash and compare';
  for (const text of [checkText(d, 'p2'), checkText(d, 'b1'), checkText(d)]) {
    assert.ok(text.split('\n').length >= 3);
    assert.ok(!/\b(ready|approved for build|complete|done|looks good)\b/i.test(text), text);
  }
  assert.throws(() => checkText(d, 'zz'), /There is no node "zz"/);
});

test('board check works from the command line and the guard allows it', async () => {
  const dir = await newBoard('P');
  execute(dir, ['add', 'box', 'One']);
  const out = execute(dir, ['check', 'b1']);
  assert.match(out, /^b1 {2}One/);
  assert.match(execute(dir, ['check']), /top level/);
  assert.match(load(dir).project.name, /P/);
  assert.equal(checkBash('board check b1', true), null);
});
