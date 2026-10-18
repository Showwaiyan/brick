import test from 'node:test';
import assert from 'node:assert/strict';
import { newBoard } from './helpers.mjs';
import { execute } from '../src/commands.mjs';
import { load } from '../src/store.mjs';
import { pageData } from '../src/render.mjs';
import { boardMermaid, nodeMermaid } from '../src/flow.mjs';
import { checkBash } from '../src/guard.mjs';

const ask = 'break down check password for me';

test('ai add --drafted creates an AI draft with the request as its quote, still drafting', async () => {
  const dir = await newBoard('P');
  execute(dir, ['add', 'box', 'Check password']);
  const out = execute(dir, ['ai', 'add', 'problem', '--title', 'Hash the password', '--parent', 'b1', '--drafted', '--user-said', ask]);
  assert.match(out, /added p1 under b1/);
  const d = load(dir);
  assert.equal(d.nodes.p1.source, 'ai-draft');
  assert.deepEqual(d.nodes.p1.said, [ask]);
  assert.equal(d.nodes.p1.status, 'drafting');
  const e = d.events.at(-1);
  assert.equal(e.actor, 'ai');
  assert.equal(e.detail.via, 'draft');
});

test('without --drafted the node is still the scribe kind', async () => {
  const dir = await newBoard('P');
  execute(dir, ['ai', 'add', 'box', '--title', 'Validate', '--user-said', 'first it validates the input']);
  assert.equal(load(dir).nodes.b1.source, 'ai-scribe');
});

test('a drafted node needs a real request, not a pointer', async () => {
  const dir = await newBoard('P');
  assert.throws(() => execute(dir, ['ai', 'add', 'box', '--title', 'X', '--drafted', '--user-said', 'option 2']), /own words/);
  assert.throws(() => execute(dir, ['ai', 'add', 'box', '--title', 'X', '--drafted']), /--user-said is required/);
  assert.equal(Object.keys(load(dir).nodes).length, 0);
});

test('ai edit --drafted fills a contract on request and marks the event, not the node source', async () => {
  const dir = await newBoard('P');
  execute(dir, ['add', 'box', 'One']);
  execute(dir, ['ai', 'edit', 'b1', '--drafted', '--user-said', 'write the contract for it', '--input', 'a name', '--output', 'a user', '--check', 'found']);
  const d = load(dir);
  assert.equal(d.nodes.b1.source, 'human');
  assert.deepEqual(d.nodes.b1.said, ['write the contract for it']);
  assert.equal(d.nodes.b1.contract.output, 'a user');
  assert.equal(d.events.at(-1).detail.via, 'draft');
});

test('the AI still cannot approve a draft, and the human can', async () => {
  const dir = await newBoard('P');
  execute(dir, ['ai', 'add', 'box', '--title', 'Solo', '--drafted', '--user-said', 'draft the flow for me', '--input', 'a', '--output', 'b', '--check', 'c']);
  assert.ok(checkBash('board approve b1', true), 'the guard blocks it');
  assert.throws(() => execute(dir, ['ai', 'approve', 'b1']), /Usage|Unknown|not/i);
  assert.equal(load(dir).nodes.b1.status, 'drafting');
});

test('ls, show, the page data and the diagrams mark an AI draft until it is approved', async () => {
  const dir = await newBoard('P');
  execute(dir, ['ai', 'add', 'box', '--title', 'Solo', '--drafted', '--user-said', 'draft the flow for me', '--input', 'a', '--output', 'b', '--check', 'c']);
  assert.match(execute(dir, ['ls']), /b1 {2}Solo {2}\[drafting\] {2}AI draft/);
  assert.match(execute(dir, ['show', 'b1']), /source: ai-draft/);
  const pd = pageData(load(dir), 'now');
  assert.equal(pd.nodes.b1.source, 'ai-draft');
  assert.match(boardMermaid(pd), /Drafting · b1 · AI draft/);
  assert.match(pd.nodes.b1.history[0].summary, /draft/);
  execute(dir, ['approve', 'b1']);
  assert.ok(!/AI draft/.test(boardMermaid(pageData(load(dir), 'now'))));
});

test('children drafted on request show the marker in the node flow too', async () => {
  const dir = await newBoard('P');
  execute(dir, ['add', 'box', 'Check password']);
  execute(dir, ['ai', 'add', 'problem', '--title', 'Hash', '--parent', 'b1', '--drafted', '--user-said', ask]);
  execute(dir, ['ai', 'add', 'problem', '--title', 'Rate limit', '--parent', 'b1', '--user-said', 'and rate limiting']);
  const text = nodeMermaid(pageData(load(dir), 'now'), 'b1');
  assert.match(text, /p1\["Hash<br\/>Drafting · p1 · AI draft"\]/);
  assert.match(text, /p2\["Rate limit<br\/>Drafting · p2"\]/);
});
