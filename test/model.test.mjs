import test from 'node:test';
import assert from 'node:assert/strict';
import { sample } from './helpers.mjs';
import { children, activeChildren, isLeaf, openGaps, displayState, nextCommands } from '../src/model.mjs';

test('children are ordered and active children skip superseded', () => {
  const d = sample();
  assert.deepEqual(children(d, 'b1').map((n) => n.id), ['p1', 'p2']);
  assert.deepEqual(children(d, null).map((n) => n.id), ['b1', 'b2']);
  d.nodes.p1.status = 'superseded';
  d.nodes.p1.superseded = { reason: 'r', by: null, cascade_from: null, at: 'x' };
  assert.deepEqual(activeChildren(d, 'b1').map((n) => n.id), ['p2']);
});

test('isLeaf is true only for problems with no active children', () => {
  const d = sample();
  assert.equal(isLeaf(d, 'p1'), true);
  assert.equal(isLeaf(d, 'b2'), false); // a box is never a leaf
  assert.equal(isLeaf(d, 'b1'), false);
});

test('displayState: superseded > has_gaps > approved > drafting', () => {
  const d = sample();
  assert.equal(displayState(d, 'p2'), 'has_gaps');
  assert.equal(displayState(d, 'b1'), 'approved');
  assert.equal(displayState(d, 'b2'), 'drafting');
  d.nodes.p2.status = 'superseded';
  d.nodes.p2.superseded = { reason: 'r', by: null, cascade_from: null, at: 'x' };
  assert.equal(displayState(d, 'p2'), 'superseded');
  assert.deepEqual(openGaps(d, 'p2').map((g) => g.id), ['g1']);
});

test('nextCommands follows the spec', () => {
  const d = sample();
  assert.deepEqual(nextCommands(d, 'b2'), ['board approve b2', 'board edit b2 --title "…"', 'board supersede b2 --why "…"']);
  assert.deepEqual(nextCommands(d, 'p2'), [
    'board gap resolve g1 --note "…"', 'board gap dismiss g1 --why "…"',
    'board edit p2 --title "…"', 'board supersede p2 --why "…"',
  ]);
  assert.deepEqual(nextCommands(d, 'b1'), ['board reopen b1 --why "…"', 'board supersede b1 --why "…"']);
  d.nodes.b2.status = 'superseded';
  d.nodes.b2.superseded = { reason: 'r', by: null, cascade_from: null, at: 'x' };
  assert.deepEqual(nextCommands(d, 'b2'), ['board restore b2']);
  d.nodes.b2.superseded.cascade_from = 'b1';
  assert.deepEqual(nextCommands(d, 'b2'), []);
});
