import test from 'node:test';
import assert from 'node:assert/strict';
import { boardMermaid, treeMermaid, nodeMermaid, drawSvg, escapeLabel } from '../src/flow.mjs';

// A small page-data object: only the fields flow.mjs reads.
function pd(nodes, roots, project = { input: null, output: null }) {
  const out = {};
  for (const [id, n] of Object.entries(nodes)) {
    const parent = n.parent ?? null;
    out[id] = { id, title: n.title ?? id, state: n.state ?? 'drafting', parent, children: [], active_children: 0, open_gaps: n.open_gaps ?? 0 };
  }
  for (const n of Object.values(out)) {
    if (n.parent) {
      out[n.parent].children.push(n.id);
      if (n.state !== 'superseded') out[n.parent].active_children += 1;
    }
  }
  return { project, roots, nodes: out };
}

test('boardMermaid: nothing to draw gives null', () => {
  assert.equal(boardMermaid(pd({}, [])), null);
});

test('boardMermaid: input, boxes in order, output, with state classes', () => {
  const text = boardMermaid(pd(
    { b1: { title: 'Validate', state: 'approved' }, b2: { title: 'Look up', open_gaps: 2, state: 'has_gaps' } },
    ['b1', 'b2'], { input: 'user and password', output: 'logged in' },
  ));
  assert.match(text, /^flowchart LR/);
  assert.match(text, /IN\(\["user and password"\]\):::io/);
  assert.match(text, /b1\["Validate<br\/>Approved · b1"\]:::approved/);
  assert.match(text, /b2\["Look up<br\/>Has gaps · b2 · 2 gaps"\]:::has_gaps/);
  assert.match(text, /IN --> b1 --> b2 --> OUT/);
});

test('boardMermaid: dropped boxes sit in their own group and are not chained', () => {
  const text = boardMermaid(pd(
    { b1: { title: 'One' }, b2: { title: 'Gone', state: 'superseded' }, b3: { title: 'Three' } },
    ['b1', 'b2', 'b3'],
  ));
  assert.match(text, /b1 --> b3/);
  assert.ok(!/b2 -->|--> b2/.test(text));
  assert.match(text, /subgraph DROP \["Dropped"\]/);
  assert.match(text, /b2\["Gone<br\/>Superseded · b2"\]:::superseded/);
});

test('boardMermaid: one live box and nothing else has no arrows', () => {
  const text = boardMermaid(pd({ b1: { title: 'Solo' } }, ['b1']));
  assert.ok(!text.includes('-->'));
  assert.match(text, /b1\[/);
});

test('treeMermaid: arrows from parent to child, top down, sub-problem counts', () => {
  const text = treeMermaid(pd(
    { b1: { title: 'Check' }, p1: { title: 'Hash', parent: 'b1' }, p2: { title: 'Limit', parent: 'b1', state: 'superseded' } },
    ['b1'],
  ));
  assert.match(text, /^flowchart TD/);
  assert.match(text, /b1 --> p1/);
  assert.match(text, /b1 -\.-> p2/);
  assert.match(text, /p2\[.*\]:::superseded/);
  assert.match(text, /b1\["Check<br\/>Drafting · b1 · 1 sub"\]/);
});

test('treeMermaid: nothing to draw gives null', () => {
  assert.equal(treeMermaid(pd({}, [])), null);
});

test('nodeMermaid: active children in order; none gives null', () => {
  const data = pd(
    { b1: { title: 'Top' }, p1: { title: 'First', parent: 'b1' }, p2: { title: 'Second', parent: 'b1' }, p3: { title: 'Old', parent: 'b1', state: 'superseded' } },
    ['b1'],
  );
  const text = nodeMermaid(data, 'b1');
  assert.match(text, /^flowchart LR/);
  assert.match(text, /p1 --> p2/);
  assert.match(text, /subgraph DROP/);
  assert.equal(nodeMermaid(data, 'p1'), null);
});

test('labels: markup characters, quotes, backslashes and newlines are encoded', () => {
  const evil = 'Say "hi" [x] <b>bold</b> \\ & line\nbreak';
  const out = escapeLabel(evil);
  for (const bad of ['"', '[', ']', '<', '>', '\\', '\n', '&']) assert.ok(!out.includes(bad), `still has ${JSON.stringify(bad)}`);
  assert.match(out, /#quot;hi#quot;/);
  assert.match(out, /#amp;/);
});

test('labels: a very long title is cut with an ellipsis', () => {
  const out = escapeLabel('x'.repeat(300));
  assert.ok(out.length <= 101);
  assert.ok(out.endsWith('…'));
});

test('drawSvg: real pele output has clickable nodes with ids and state classes', () => {
  const svg = drawSvg(boardMermaid(pd(
    { b1: { title: 'Validate', state: 'approved' }, b2: { title: 'Look up' } }, ['b1', 'b2'], { input: 'in', output: 'out' },
  )));
  assert.match(svg, /^<svg /);
  assert.match(svg, /class="pele-node[^"]*approved[^"]*" data-id="b1"/);
  assert.match(svg, /data-id="b2"/);
});

test('drawSvg: hostile titles do not put markup in the SVG', () => {
  const evil = '<img src=x onerror=alert(1)></script><script>alert(2)</script>';
  const svg = drawSvg(boardMermaid(pd({ b1: { title: evil } }, ['b1'], { input: evil, output: evil })));
  assert.ok(svg.startsWith('<svg'));
  assert.ok(!/<(img|script)\b/i.test(svg));
});

test('drawSvg: bad input gives null instead of throwing', () => {
  assert.equal(drawSvg(null), null);
  assert.equal(drawSvg(''), null);
  assert.equal(drawSvg('this is not a diagram at all'), null);
  assert.equal(drawSvg('flowchart LR\n' + 'a --> b\n'.repeat(200000)), null);
});
