import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveKey, fullId, parseId, compareIds, parentOf, fid, decorateIds } from '../src/ids.mjs';

test('deriveKey makes a short upper-case key from the name', () => {
  assert.equal(deriveKey('Login'), 'LOGIN');
  assert.equal(deriveKey('Export report'), 'EXPORT');
  assert.equal(deriveKey('I want to build a login system'), 'LOGIN');
  assert.equal(deriveKey('Checkout flow v2'), 'CHECKO');
  assert.equal(deriveKey('42'), 'BOARD');
  assert.equal(deriveKey('x'), 'BOARD');
});

test('deriveKey avoids a taken key and stays within 6 characters', () => {
  assert.equal(deriveKey('Login', ['LOGIN']), 'LOGIN2');
  assert.equal(deriveKey('Login', ['LOGIN', 'LOGIN2']), 'LOGIN3');
  assert.equal(deriveKey('Checkout', ['CHECKO']), 'CHECK2');
});

test('fullId adds the key only when there is one', () => {
  assert.equal(fullId('LOGIN', 'p3.1'), 'LOGIN-p3.1');
  assert.equal(fullId(null, 'p3.1'), 'p3.1');
});

test('parseId reads full and short ids, and nothing else', () => {
  assert.deepEqual(parseId('LOGIN-p3.1'), { key: 'LOGIN', short: 'p3.1' });
  assert.deepEqual(parseId('login-p3'), { key: 'LOGIN', short: 'p3' });
  assert.deepEqual(parseId('p3.1.g2'), { key: null, short: 'p3.1.g2' });
  assert.deepEqual(parseId('g2'), { key: null, short: 'g2' });
  assert.deepEqual(parseId('b1'), { key: null, short: 'b1' });
  for (const bad of ['hello', 'LOGIN-', 'p3.', 'p3..1', '', 'LOGIN-hello']) assert.equal(parseId(bad), null, bad);
});

test('compareIds sorts by segment numbers, not as text', () => {
  const ids = ['p3.10', 'p3.2', 'p3', 'p2', 'b1', 'p3.1.g1', 'p3.1'];
  assert.deepEqual(ids.slice().sort(compareIds), ['b1', 'p2', 'p3', 'p3.1', 'p3.1.g1', 'p3.2', 'p3.10']);
});

test('parentOf drops the last segment', () => {
  assert.equal(parentOf('p3.1.2'), 'p3.1');
  assert.equal(parentOf('p3'), null);
  assert.equal(parentOf('p3.1.g2'), 'p3.1');
});

test('fid uses the board key when the data has one', () => {
  assert.equal(fid({ project: { key: 'LOGIN' } }, 'p1'), 'LOGIN-p1');
  assert.equal(fid({ project: {} }, 'p1'), 'p1');
});

test('decorateIds adds the key to bare ids in a result line', () => {
  assert.equal(decorateIds('added p3.1 under p3', 'LOGIN'), 'added LOGIN-p3.1 under LOGIN-p3');
  assert.equal(decorateIds('raised p3.g1 on p3.', 'LOGIN'), 'raised LOGIN-p3.g1 on LOGIN-p3.');
  assert.equal(decorateIds('restored b1, p2 (as drafting)', 'LOGIN'), 'restored LOGIN-b1, LOGIN-p2 (as drafting)');
  assert.equal(decorateIds('added LOGIN-p3', 'LOGIN'), 'added LOGIN-p3');
  assert.equal(decorateIds('added p3', null), 'added p3');
});

test('note ids (s1) parse, sort and gain the key like other ids', () => {
  assert.deepEqual(parseId('LOGIN-s2'), { key: 'LOGIN', short: 's2' });
  assert.deepEqual(parseId('s2'), { key: null, short: 's2' });
  assert.equal(decorateIds('recorded s3', 'LOGIN'), 'recorded LOGIN-s3');
  assert.equal(decorateIds('added p3', 'LOGIN'), 'added LOGIN-p3');
  assert.deepEqual(['s10', 's2', 'p1'].sort(compareIds), ['p1', 's2', 's10']);
});
