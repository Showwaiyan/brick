import test from 'node:test';
import assert from 'node:assert/strict';
import { newBoard } from './helpers.mjs';
import { execute } from '../src/commands.mjs';
import { load } from '../src/store.mjs';
import { pageData } from '../src/render.mjs';

async function boardWithBox() {
  const dir = await newBoard('P');
  execute(dir, ['add', 'box', 'Check password']);
  return dir;
}

test('ai gap --kind stores the kind and shows it', async () => {
  const dir = await boardWithBox();
  execute(dir, ['ai', 'gap', 'b1', '--missing', 'Nothing says what happens on two attempts at once.', '--kind', 'edge-case']);
  assert.equal(load(dir).gaps['b1.g1'].kind, 'edge-case');
  assert.match(execute(dir, ['show', 'b1']), /b1\.g1 \[open\] \(edge-case\) Nothing says what happens on two attempts at once\./);
  assert.equal(pageData(load(dir), 'now').nodes.b1.gaps[0].kind, 'edge-case');
});

test('every documented kind is accepted', async () => {
  const dir = await boardWithBox();
  for (const k of ['edge-case', 'architecture', 'assumption', 'order', 'other']) {
    execute(dir, ['ai', 'gap', 'b1', '--missing', `Nothing covers the ${k} situation here.`, '--kind', k]);
  }
  assert.deepEqual(Object.values(load(dir).gaps).map((g) => g.kind), ['edge-case', 'architecture', 'assumption', 'order', 'other']);
});

test('an unknown kind is rejected and lists the real ones', async () => {
  const dir = await boardWithBox();
  assert.throws(() => execute(dir, ['ai', 'gap', 'b1', '--missing', 'Nothing covers this situation at all.', '--kind', 'bug']),
    /edge-case, architecture, assumption, order, other/);
  assert.equal(Object.keys(load(dir).gaps).length, 0);
});

test('the kind is optional, and a gap without one shows none', async () => {
  const dir = await boardWithBox();
  execute(dir, ['ai', 'gap', 'b1', '--missing', 'Nothing says what happens when the username does not exist.']);
  assert.equal(load(dir).gaps['b1.g1'].kind ?? null, null);
  assert.match(execute(dir, ['show', 'b1']), /b1\.g1 \[open\] Nothing says/);
});

test('a fix-sounding gap is still rejected, with a kind or not', async () => {
  const dir = await boardWithBox();
  assert.throws(() => execute(dir, ['ai', 'gap', 'b1', '--missing', 'You should add a retry limit here.', '--kind', 'edge-case']), /not how to fill it/);
});
