import test from 'node:test';
import assert from 'node:assert/strict';
import { lintSaid } from '../src/rules.mjs';
import { execute } from '../src/commands.mjs';
import { newBoard } from './helpers.mjs';

const POINTERS = [
  'yes', 'Yes.', 'ok', 'OK!', 'okay', 'sure', 'agreed', 'sounds good', 'do it', 'go ahead', 'that works', 'exactly',
  'option 2', 'Option B', 'option two', 'number 3', '#2', '2', 'b', 'the first one', 'the second option', 'the last one', 'first',
  'that one', 'this one', 'the same', 'go with it', 'go with that', "let's go with that", "I'll go with option 2", 'go with the second one',
  'go with your idea', "let's go with your suggestion", 'your idea', 'your suggestion then', 'as you said', 'like you suggested',
  'use that', 'do it your way', '...', '“yes”',
];

const REAL = [
  'option 2, because it needs no server',
  'validate the input',
  'Yes, and it must also reject empty usernames',
  'I want to use SQLite because the app is single-user',
  'the first step checks the username',
  'go with a queue so retries do not block the request',
  'that one is too slow for our case, so no',
  'ok but only for admins',
];

test('lintSaid: a bare pointer to what the AI said is rejected, with what to do', () => {
  for (const q of POINTERS) {
    assert.throws(() => lintSaid(q), /only points at something Claude said.*own words/s, JSON.stringify(q));
  }
});

test('lintSaid: a real sentence passes, even one that starts with a pointer', () => {
  for (const q of REAL) assert.equal(lintSaid(q), q.trim(), JSON.stringify(q));
});

test('lintSaid: the quote is returned trimmed', () => {
  assert.equal(lintSaid('  I want a queue  '), 'I want a queue');
});

test('ai add, edit and project reject a pointer quote and change nothing', async () => {
  const dir = await newBoard('P');
  assert.throws(() => execute(dir, ['ai', 'add', 'box', '--title', 'Pick a store', '--user-said', 'option 2']), /own words/);
  assert.throws(() => execute(dir, ['ai', 'project', '--user-said', 'go with that', '--input', 'x']), /own words/);
  execute(dir, ['ai', 'add', 'box', '--title', 'Pick a store', '--user-said', 'I want SQLite because it is one file']);
  assert.throws(() => execute(dir, ['ai', 'edit', 'b1', '--user-said', 'yes', '--desc', 'x']), /own words/);
  assert.match(execute(dir, ['ls']), /b1 {2}Pick a store/);
  assert.ok(!/log/.test('') && !/option 2/.test(execute(dir, ['log'])));
});
