import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmp, sample } from './helpers.mjs';
import { create, load, mutate, validate, emptyData, nextId, addEvent } from '../src/store.mjs';

test('atomic write leaves no temp file and no lock', () => {
  const dir = path.join(tmp(), '.board');
  create(dir, emptyData('x'));
  mutate(dir, (d) => { d.project.name = 'y'; });
  assert.deepEqual(fs.readdirSync(dir), ['tree.json']);
  assert.equal(load(dir).project.name, 'y');
});

test('invalid data is rejected before writing', () => {
  const dir = path.join(tmp(), '.board');
  create(dir, emptyData('x'));
  const before = fs.readFileSync(path.join(dir, 'tree.json'), 'utf8');
  assert.throws(() => mutate(dir, (d) => { d.gaps.g1 = { id: 'g1', node: 'nope', status: 'open' }; }), /does not exist/);
  assert.equal(fs.readFileSync(path.join(dir, 'tree.json'), 'utf8'), before);
  assert.deepEqual(fs.readdirSync(dir), ['tree.json']);
});

test('a stale lock is taken over', () => {
  const dir = path.join(tmp(), '.board');
  create(dir, emptyData('x'));
  const lock = path.join(dir, '.lock');
  fs.writeFileSync(lock, '');
  const old = new Date(Date.now() - 60000);
  fs.utimesSync(lock, old, old);
  mutate(dir, (d) => { d.project.name = 'z'; });
  assert.equal(load(dir).project.name, 'z');
});

test('a fresh lock blocks the write', () => {
  const dir = path.join(tmp(), '.board');
  create(dir, emptyData('x'));
  fs.writeFileSync(path.join(dir, '.lock'), '');
  assert.throws(() => mutate(dir, () => {}), /Try again/);
});

test('ids are never reused after a supersede', () => {
  const data = emptyData('x');
  assert.equal(nextId(data, 'b'), 'b1');
  assert.equal(nextId(data, 'b'), 'b2');
  data.nodes.b2 = undefined; // even if b2 vanished, the counter stays up
  assert.equal(nextId(data, 'b'), 'b3');
});

test('validation catches structural mistakes', () => {
  const ok = sample();
  validate(ok);
  const bad = (fn, re) => { const d = sample(); fn(d); assert.throws(() => validate(d), re); };
  bad((d) => { d.nodes.p1.parent = 'zz'; }, /does not exist/);
  bad((d) => { d.nodes.b1.parent = 'b2'; }, /box must have parent null/);
  bad((d) => { d.nodes.p2.order = 1; }, /order 1 already used/);
  bad((d) => { d.nodes.p1.parent = 'p2'; d.nodes.p2.parent = 'p1'; }, /cycle/);
  bad((d) => { d.nodes.p1.status = 'superseded'; }, /disagree/);
  bad((d) => { d.counters.p = 1; }, /counter is behind/);
  bad((d) => { addEvent(d, 'human', 'add', 'b1'); d.events[0].seq = 5; }, /seq/);
});
