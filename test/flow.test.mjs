import test from 'node:test';
import assert from 'node:assert/strict';
import { boardMermaid, treeMermaid, nodeMermaid, drawSvg, escapeLabel, addTags, addDiagrams, __setTagger } from '../src/flow.mjs';
import { tagsFor } from '../src/tags.mjs';
import vm from 'node:vm';
import fs from 'node:fs';

const canvas = vm.createContext({});
vm.runInContext(fs.readFileSync('src/canvas.js', 'utf8'), canvas);
const { diagramNodeId } = canvas;

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
  ), 'plain');
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
  ), 'plain');
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
  ), 'plain');
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

test('nested ids: Mermaid ids have no dots, and labels show the board key', () => {
  const data = pd({ b1: { title: 'One' }, p1: { parent: 'b1' }, 'p1.1': { parent: 'p1', title: 'Deep' } }, ['b1']);
  data.project = { input: null, output: null, key: 'LOGIN', name: 'Login' };
  const tree = treeMermaid(data, 'plain');
  assert.match(tree, /p1_1\["Deep<br\/>Drafting · LOGIN-p1\.1"\]:::drafting/);
  assert.match(tree, /p1 --> p1_1/);
  assert.ok(!/p1\.1\[|--> p1\.1/.test(tree));
  assert.match(nodeMermaid(data, 'p1', 'plain'), /p1_1\[/);
  assert.ok(drawSvg(tree).includes('p1_1'), 'pele draws it');
});

// ---------- tags ----------

// Page data with the fields the tags read.
function tagged() {
  const data = pd({
    b1: { title: 'Check password', state: 'drafting', open_gaps: 1 },
    p1: { title: 'Hash', parent: 'b1', state: 'drafting' },
    'p1.1': { title: 'Deep', parent: 'p1', state: 'drafting' },
    p2: { title: 'Old', parent: 'b1', state: 'superseded' },
    b2: { title: 'Gone', state: 'superseded' },
  }, ['b1', 'b2'], { input: null, output: null, key: 'LOGIN', shown: 'User query', name: 'I want to build user query' });
  data.nodes.b1.source = 'ai-draft';
  return data;
}

const tagTexts = (svg, id) => {
  const group = svg.match(new RegExp(`<g class="pele-node [^"]*" data-id="${id}"[\\s\\S]*?</g></g></g>`))[0];
  return [...group.matchAll(/<text class="tag-text"[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
};

test('tags mode: bold title and one reserved line per tag row', () => {
  const text = boardMermaid(tagged());
  assert.match(text, /b1\["<b>Check password<\/b>(<br\/>x+)+"\]:::drafting/);
  assert.ok(!/Drafting · /.test(text));
  assert.match(boardMermaid(tagged(), 'plain'), /b1\["Check password<br\/>Drafting · LOGIN-b1 · AI draft · 1 sub · 1 gap"\]/);
});

test('tags mode: the tree root shows the shown title, not the name', () => {
  const text = treeMermaid(tagged());
  assert.match(text, /ROOT\(\["<b>User query<\/b><br\/>x+"\]\):::io/);
  assert.ok(!text.includes('I want to build'));
  const noKey = tagged();
  noKey.project.key = undefined;
  assert.match(treeMermaid(noKey), /ROOT\(\["<b>User query<\/b>"\]\):::io/);
});

test('tags mode: markup and long titles stay escaped and cut', () => {
  const evil = tagged();
  evil.nodes.b1.title = '<img src=x onerror=alert(1)> & "q" ' + 'y'.repeat(300);
  const text = boardMermaid(evil);
  const label = text.match(/b1\["(.*?)"\]:::/)[1];
  assert.ok(!/<(?!\/?b>|br\/>)/.test(label), label);
  assert.ok(label.length < 400);
  assert.ok(!drawSvg(text).match(/<img/i));
});

test('addTags: each node gets its tags, in order, inside its box', () => {
  const data = tagged();
  const svg = addTags(drawSvg(treeMermaid(data)), data);
  assert.ok(svg);
  assert.deepEqual(tagTexts(svg, 'b1'), ['LOGIN-b1', 'Drafting', 'AI draft', '1 sub', '1 gap']);
  assert.deepEqual(tagTexts(svg, 'ROOT'), ['LOGIN']);
  assert.deepEqual(tagTexts(svg, 'p1_1'), ['LOGIN-p1.1', 'Drafting']);
  assert.deepEqual(tagTexts(svg, 'p2'), ['LOGIN-p2', 'Superseded']);
  assert.ok(!/>x+<\/tspan>/.test(svg), 'placeholders are blanked');
  let checked = 0;
  for (const g of svg.matchAll(/<g class="pele-node [^"]*" data-id="([^"]+)" transform="translate\(([-\d.]+),([-\d.]+)\)">([\s\S]*?)<\/g><\/g><\/g>|<g class="pele-node [^"]*" data-id="([^"]+)" transform="translate\(([-\d.]+),([-\d.]+)\)">([\s\S]*?)<\/g>/g)) {
    const inner = g[4] || g[8];
    const rect = inner.match(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/);
    for (const t of inner.matchAll(/<g class="tag [^"]*"><rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)) {
      checked += 1;
      assert.ok(Number(t[1]) >= Number(rect[1]) - 0.01, 'left edge');
      assert.ok(Number(t[1]) + Number(t[3]) <= Number(rect[1]) + Number(rect[3]) + 0.01, 'right edge');
      assert.ok(Number(t[2]) >= Number(rect[2]) - 0.01 && Number(t[2]) + Number(t[4]) <= Number(rect[2]) + Number(rect[4]) + 0.01, 'inside, up and down');
    }
  }
  assert.ok(checked >= 10, `checked ${checked} tags`);
});

test('addTags: five tags wrap to a second row and the box grows', () => {
  const data = tagged();
  const svg = addTags(drawSvg(boardMermaid(data)), data);
  const h = (id) => Number(svg.match(new RegExp(`data-id="${id}"[^>]*><rect x="[-\\d.]+" y="[-\\d.]+" width="[\\d.]+" height="([\\d.]+)"`))[1]);
  assert.ok(h('b1') > h('b2'), `b1 ${h('b1')} b2 ${h('b2')}`);
  assert.equal(new Set([...svg.match(/data-id="b1"[\s\S]*?<\/g><\/g><\/g>/)[0].matchAll(/<rect x="[-\d.]+" y="([-\d.]+)" width="\d+" height="20"/g)].map((m) => m[1])).size, 2);
});

test('addTags: the dropped group and dotted ids still resolve; clicking maps back', () => {
  const data = tagged();
  const svg = addTags(drawSvg(boardMermaid(data)), data);
  assert.deepEqual(tagTexts(svg, 'b2'), ['LOGIN-b2', 'Superseded']);
  const tree = addTags(drawSvg(treeMermaid(data)), data);
  assert.ok(tree.includes('data-id="p1_1"'));
  assert.equal(diagramNodeId(data.nodes, 'p1_1'), 'p1.1');
});

test('addTags: an SVG it does not understand gives null, and the diagrams fall back to plain labels', () => {
  assert.equal(addTags('<svg></svg>', tagged()), null);
  __setTagger(() => null);
  try {
    const data = tagged();
    addDiagrams(data);
    assert.ok(data.tree_svg && data.board_svg);
    assert.ok(!data.tree_svg.includes('pele-tags'));
    assert.match(data.tree_svg, /Drafting/);
    assert.match(data.tree_svg, /LOGIN-b1/);
  } finally {
    __setTagger(null);
  }
});

test('addDiagrams: tagged by default', () => {
  const data = tagged();
  addDiagrams(data);
  assert.ok(data.tree_svg.includes('pele-tags'));
  assert.ok(data.nodes.b1.flow_svg.includes('pele-tags'));
  assert.deepEqual(tagsFor(data, 'b1').map((t) => t.kind), ['id', 'state', 'source', 'sub', 'gap']);
});
