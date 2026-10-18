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

// ---------- nested ids ----------

import { newBoard } from './helpers.mjs';
import { execute } from '../src/commands.mjs';

test('children get nested ids, and a number is never reused', async () => {
  const dir = await newBoard();
  const x = (...a) => execute(dir, a);
  assert.match(x('add', 'box', 'One'), /added b1/);
  assert.match(x('add', 'problem', 'A', '--parent', 'b1'), /added p1 under b1/);
  assert.match(x('add', 'problem', 'A1', '--parent', 'p1'), /added p1\.1 under p1/);
  assert.match(x('add', 'problem', 'A2', '--parent', 'p1'), /added p1\.2 under p1/);
  assert.match(x('add', 'problem', 'A11', '--parent', 'p1.1'), /added p1\.1\.1 under p1\.1/);
  x('supersede', 'p1.2', '--why', 'not needed');
  assert.match(x('add', 'problem', 'A3', '--parent', 'p1'), /added p1\.3 under p1/);
  assert.match(x('add', 'problem', 'Early', '--parent', 'p1', '--after', 'p1.1'), /added p1\.4 under p1/);
  assert.deepEqual(Object.keys(load(dir).nodes).sort(), ['b1', 'p1', 'p1.1', 'p1.1.1', 'p1.2', 'p1.3', 'p1.4']);
});

test('gaps get nested ids, numbered per node, and a number is never reused', async () => {
  const dir = await newBoard();
  const x = (...a) => execute(dir, a);
  x('add', 'box', 'One');
  x('add', 'problem', 'A', '--parent', 'b1');
  x('add', 'problem', 'A1', '--parent', 'p1');
  const gap = () => x('ai', 'gap', 'p1.1', '--missing', 'Nothing says what happens when the list is empty.');
  assert.match(gap(), /raised p1\.1\.g1 on p1\.1/);
  assert.match(gap(), /raised p1\.1\.g2 on p1\.1/);
  x('gap', 'dismiss', 'p1.1.g1', '--why', 'not real');
  assert.match(gap(), /raised p1\.1\.g3 on p1\.1/);
  assert.match(x('ai', 'gap', 'p1', '--missing', 'Nothing says what happens when the list is empty.'), /raised p1\.g1 on p1/);
});

test('validate checks nested ids against their parent and node', () => {
  const d = sample();
  d.nodes['p1.1'] = { ...d.nodes.p2, id: 'p1.1', parent: 'b1', order: 5 };
  assert.throws(() => validate(d), /p1\.1: id does not match its parent/);
  d.nodes['p1.1'].parent = 'p1';
  validate(d);
  d.gaps['p2.g1'] = { ...d.gaps.g1, id: 'p2.g1', node: 'p1' };
  assert.throws(() => validate(d), /p2\.g1: id does not match its node/);
  d.gaps['p2.g1'].node = 'p2';
  validate(d);
  validate(sample());
});

// A note on p1 of the sample tree.
const note = (over = {}) => ({ id: 's1', node: 'p1', path: 'src/a.js', line: null, note: 'does a thing', hash: null, at: 'x', replaces: null, ...over });
const withNotes = (notes, counter = Object.keys(notes).length) => {
  const d = sample();
  d.seen = notes;
  d.counters.s = counter;
  return d;
};

test('validate: a seen map is accepted, and a file without one still is', () => {
  validate(sample());
  validate(withNotes({ s1: note(), s2: note({ id: 's2', node: null, replaces: 's1', line: 12, hash: 'ab'.repeat(20) }) }));
});

test('validate: a bad note is rejected, with its id in the message', () => {
  const bad = {
    'key differs from id': { s1: note({ id: 's9' }) },
    'unknown node': { s1: note({ node: 'p9' }) },
    'replaces unknown': { s1: note({ replaces: 's7' }) },
    'replaces itself': { s1: note({ replaces: 's1' }) },
    'dot dot path': { s1: note({ path: '../x' }) },
    'absolute path': { s1: note({ path: '/etc/hosts' }) },
    'empty path': { s1: note({ path: '' }) },
    'empty note': { s1: note({ note: '' }) },
    'two lines': { s1: note({ note: 'a\nb' }) },
    'too long': { s1: note({ note: 'x'.repeat(301) }) },
    'line zero': { s1: note({ line: 0 }) },
  };
  for (const [what, notes] of Object.entries(bad)) assert.throws(() => validate(withNotes(notes)), /s\d/, what);
  assert.throws(() => validate(withNotes({ s3: note({ id: 's3' }) }, 1)), /counter/);
});
