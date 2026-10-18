import test from 'node:test';
import assert from 'node:assert/strict';
import { TAG, tagsFor, rootTags, tagWidth, layoutTags, wrapWidthFor } from '../src/tags.mjs';

const pd = (node, key = 'LOGIN') => ({ project: { key }, nodes: { p1: { id: 'p1', title: 'T', state: 'drafting', source: 'ai-draft', active_children: 2, open_gaps: 1, ...node } } });

test('tagsFor: id, state, source, sub-steps, gaps, in that order', () => {
  const tags = tagsFor(pd({}), 'p1');
  assert.deepEqual(tags.map((t) => t.kind), ['id', 'state', 'source', 'sub', 'gap']);
  assert.deepEqual(tags.map((t) => t.text), ['LOGIN-p1', 'Drafting', 'AI draft', '2 sub', '1 gap']);
  assert.equal(tags[1].state, 'drafting');
});

test('tagsFor: no AI draft tag once approved or superseded; plural gaps; no key', () => {
  assert.ok(!tagsFor(pd({ state: 'approved' }), 'p1').some((t) => t.kind === 'source'));
  assert.ok(!tagsFor(pd({ state: 'superseded' }), 'p1').some((t) => t.kind === 'source'));
  assert.equal(tagsFor(pd({ open_gaps: 3 }), 'p1').at(-1).text, '3 gaps');
  assert.equal(tagsFor(pd({ source: 'human', active_children: 0, open_gaps: 0 }, null), 'p1').map((t) => t.text).join('|'), 'p1|Drafting');
});

test('rootTags: the key, or nothing', () => {
  assert.deepEqual(rootTags({ project: { key: 'LOGIN' } }), [{ kind: 'key', text: 'LOGIN' }]);
  assert.deepEqual(rootTags({ project: {} }), []);
});

test('tagWidth comes from the text length', () => {
  assert.equal(tagWidth('USER-b1'), Math.ceil(7 * 7.2) + 16);
});

test('layoutTags: one row when it fits, two when it does not, and x restarts', () => {
  const tags = tagsFor(pd({}), 'p1');
  assert.equal(layoutTags(tags, 400).rows.length, 1);
  const two = layoutTags(tags, 240);
  assert.equal(two.rows.length, 2);
  for (const r of two.rows) {
    assert.equal(r[0].x, 0);
    for (let i = 1; i < r.length; i++) assert.ok(r[i].x > r[i - 1].x);
    if (r.length > 1) assert.ok(r.at(-1).x + r.at(-1).w <= 240);
  }
  assert.equal(layoutTags([], 200).rows.length, 0);
  assert.equal(layoutTags([], 200).width, 0);
});

test('wrapWidthFor is clamped', () => {
  assert.equal(wrapWidthFor('a'), TAG.MIN_WRAP);
  assert.equal(wrapWidthFor('a'.repeat(100)), TAG.MAX_WRAP);
});
