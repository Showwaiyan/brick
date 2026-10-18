import test from 'node:test';
import assert from 'node:assert/strict';
import { newBoard, sample } from './helpers.mjs';
import { execute } from '../src/commands.mjs';
import { load, validate } from '../src/store.mjs';
import { shortName, shownTitle } from '../src/title.mjs';
import { pageData, renderHtml } from '../src/render.mjs';

test('shortName drops the filler start and cuts at a word', () => {
  assert.equal(shortName('I want to build user query feature with express js in controller, services, repository pattern.'),
    'User query feature with express js in…');
  assert.equal(shortName('login feature for my app'), 'Login feature for my app');
  assert.equal(shortName("I'd like to add a CSV export."), 'CSV export');
  assert.equal(shortName('Export report'), 'Export report');
});

test('shortName never returns empty and cuts one long word', () => {
  assert.equal(shortName('x'.repeat(90)), `X${'x'.repeat(38)}…`);
  assert.equal(shortName('I want to build').length > 0, true);
  assert.ok(shortName('a'.repeat(200) + ' b').length <= 40);
});

test('shownTitle prefers the set title', () => {
  assert.equal(shownTitle({ name: 'x', title: 'Short' }), 'Short');
  assert.equal(shownTitle({ name: 'login feature for my app' }), 'Login feature for my app');
});

test('ai project --title sets the title without a quote', async () => {
  const dir = await newBoard('I want to build user query feature');
  assert.match(execute(dir, ['ai', 'project', '--title', 'User query']), /updated project \(title\)/);
  const d = load(dir);
  assert.equal(d.project.title, 'User query');
  assert.equal(d.project.name, 'I want to build user query feature');
  const ev = d.events.at(-1);
  assert.equal(ev.action, 'title');
  assert.equal(ev.actor, 'ai');
  assert.equal(ev.detail.previous, null);
  execute(dir, ['ai', 'project', '--title', 'Query feature']);
  assert.equal(load(dir).events.at(-1).detail.previous, 'User query');
  assert.match(execute(dir, ['log']), /title/);
});

test('ai project --title refuses a bad title', async () => {
  const dir = await newBoard();
  assert.throws(() => execute(dir, ['ai', 'project', '--title', '']), /title/);
  assert.throws(() => execute(dir, ['ai', 'project', '--title', 'x'.repeat(41)]), /40/);
  assert.throws(() => execute(dir, ['ai', 'project', '--title', 'a\nb']), /one line/);
});

test('input and output still need the user\'s words, also next to a title', async () => {
  const dir = await newBoard();
  assert.throws(() => execute(dir, ['ai', 'project', '--input', 'x']), /--user-said is required/);
  assert.throws(() => execute(dir, ['ai', 'project', '--title', 't', '--input', 'x']), /--user-said is required/);
  execute(dir, ['ai', 'project', '--title', 't', '--input', 'x', '--user-said', 'it takes x']);
  assert.equal(load(dir).project.input, 'x');
});

test('a file with no title loads, and validate checks the title', () => {
  const d = sample();
  validate(d);
  for (const bad of ['', 'x'.repeat(41), 'a\nb', 5]) {
    const e = sample();
    e.project.title = bad;
    assert.throws(() => validate(e), /title/, String(bad));
  }
  d.project.title = 'Fine';
  validate(d);
});

test('the page data and the tab title use the shown title', async () => {
  const dir = await newBoard('I want to build <b>login</b> feature for the app today please');
  const d = load(dir);
  assert.equal(pageData(d, 'now').project.shown, shownTitle(d.project));
  const html = renderHtml(d);
  assert.match(html, /<title>[^<]*&lt;b&gt;/);
  execute(dir, ['ai', 'project', '--title', 'A & B']);
  assert.match(renderHtml(load(dir)), /<title>A &amp; B - /);
});

test('a hostile title cannot put markup in the page or the diagrams', async () => {
  const evil = '</script><img src=x onerror=alert(1)>';
  const dir = await newBoard(evil);
  execute(dir, ['add', 'box', evil]);
  execute(dir, ['ai', 'project', '--title', evil.slice(0, 40)]);
  const html = renderHtml(load(dir));
  assert.equal(html.split('</script').length - 1, 2, 'only our own two closing tags');
  assert.ok(!html.includes('<img'));
  const page = pageData(load(dir), 'now');
  assert.equal(page.project.shown, evil.slice(0, 40));
});
