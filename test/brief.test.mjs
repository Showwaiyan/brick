import test from 'node:test';
import assert from 'node:assert/strict';
import { sample } from './helpers.mjs';
import { brief, briefNoActive } from '../src/text.mjs';

const boards = [{ key: 'EXPORT', name: 'Export report' }, { key: 'LOGIN', name: 'Login' }];

test('with one board the brief names its key and adds no board rules', () => {
  const d = sample();
  d.project.key = 'LOGIN';
  const out = brief(d, { boards: [boards[1]], active: 'LOGIN' });
  assert.match(out, /^Project: t \(board LOGIN\)/);
  assert.ok(!/Boards:/.test(out));
  assert.ok(!/Using board/.test(out));
  assert.match(out, /LOGIN-g1 on LOGIN-p2/);
});

test('with several boards the brief lists them and gives the rules for choosing one', () => {
  const d = sample();
  d.project.key = 'LOGIN';
  const out = brief(d, { boards, active: 'LOGIN' });
  assert.match(out, /\nBoards: EXPORT, LOGIN \(active\)\n/);
  assert.match(out, /--board <KEY>/);
  assert.match(out, /Using board <KEY>\./);
  assert.match(out, /never for approve, supersede, resolve, dismiss, reopen or restore/);
  assert.match(out, /Which board is this for\? \(<KEYS>\)/);
  assert.match(out, /means nothing for you; it is only the default for the user's typed commands/);
  assert.match(out, /^Project: .*\nBoards: .*\nIMPORTANT, several boards/);
});

test('with several boards and none active the brief asks which board and carries the same rules', () => {
  const out = briefNoActive({ boards });
  assert.match(out, /^Boards: EXPORT, LOGIN\n/);
  assert.match(out, /No board is active/);
  assert.match(out, /Using board <KEY>\./);
});

test('the brief tells the AI to read the code before it drafts', () => {
  const out = brief(sample());
  assert.match(out, /first read the code the work touches/);
  assert.match(out, /say which files you based it on/);
});

test('the brief tells the AI to look up a node it does not remember', () => {
  assert.match(brief(sample()), /look it up with board ls before saying you do not know it/);
});
