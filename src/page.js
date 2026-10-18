// Draws the board from the embedded data. Display only: every rule was applied in Node.
// Classic script, plain functions. The DOM is built with createElement and textContent only.
var DATA = JSON.parse(document.getElementById('data').textContent);
var STATE_LABEL = { approved: 'Approved', has_gaps: 'Has gaps', drafting: 'Drafting', superseded: 'Superseded' };
var S = { view: 'flow', node: null }; // what the page is showing

// Makes an element, optionally with a class and text.
function el(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
function when(iso) { return new Date(iso).toLocaleString(); }

// ---------- state in the URL hash ----------

function readHash() {
  var p = new URLSearchParams(location.hash.slice(1));
  var n = p.get('node');
  S.view = p.get('view') === 'tree' ? 'tree' : 'flow';
  S.node = n && DATA.nodes[n] ? n : null;
}

function writeHash(push) {
  var p = new URLSearchParams();
  p.set('view', S.view);
  if (S.node) p.set('node', S.node);
  try { history[push ? 'pushState' : 'replaceState'](null, '', '#' + p.toString()); } catch (e) { location.hash = p.toString(); }
}

// Changes the page state, remembers it in the hash, redraws. Opening a node page adds a history entry.
function go(change) {
  var opened = 'node' in change && change.node && change.node !== S.node;
  for (var k in change) S[k] = change[k];
  writeHash(opened);
  draw();
  if ('node' in change) window.scrollTo(0, 0);
}

// ---------- pieces ----------

function renderHeader() {
  var h = el('header', 'top');
  var c = DATA.counts;
  if (DATA.overview) {
    var all = el('a', 'link', '\u2190 All boards');
    all.href = DATA.overview;
    h.append(all);
  }
  h.append(el('h1', null, DATA.project.shown));
  if (DATA.project.shown !== DATA.project.name) h.append(el('p', 'muted you-said', 'You said: ' + DATA.project.name));
  h.append(el('p', 'meta', (DATA.project.key ? 'Board ' + DATA.project.key + ' \u00b7 ' : '') + 'Last updated ' + when(DATA.generated_at)));
  h.append(el('p', 'counts', c.approved + ' approved · ' + plural(c.open_gaps, 'open gap') + ' · ' + c.drafting + ' drafting' +
    (c.superseded ? ' · ' + c.superseded + ' superseded' : '')));
  var tabs = el('div', 'tabs');
  tabs.setAttribute('role', 'tablist');
  ['flow', 'tree'].forEach(function (v) {
    var b = el('button', 'tab', v === 'flow' ? 'Flow' : 'Tree');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(S.view === v));
    b.dataset.key = 'tab:' + v;
    b.addEventListener('click', function () { go({ view: v, node: null }); });
    tabs.append(b);
  });
  h.append(tabs);
  h.append(el('p', 'muted', 'Read-only. Decide with the /brick commands in Claude Code.'));
  return h;
}

// The id, state, source and counts of a node as tags (the same facts and classes as the tags in the diagrams).
function renderTags(n) {
  var box = el('span', 'tags');
  function tag(kind, text, extra) { box.append(el('span', 'tag tag-' + kind + (extra ? ' ' + extra : ''), text)); }
  tag('id', showId(DATA.project.key, n.id));
  tag('state', STATE_LABEL[n.state] || n.state, 'tag-state-' + n.state);
  if (n.source === 'ai-draft' && n.state !== 'approved' && n.state !== 'superseded') tag('source', 'AI draft');
  if (n.active_children) tag('sub', n.active_children + ' sub');
  if (n.open_gaps) tag('gap', plural(n.open_gaps, 'gap'));
  return box;
}

// One node as a card. Only used when a diagram could not be drawn.
function renderNodeCard(id) {
  var n = DATA.nodes[id];
  var b = el('button', 'card state-' + n.state);
  b.type = 'button';
  b.dataset.key = 'card:' + id;
  b.append(el('span', 'card-title', n.title));
  b.append(renderTags(n));
  b.addEventListener('click', function () { go({ node: id }); });
  return b;
}

// The plain outline: every node as a card, children indented.
function treeList(ids) {
  var ul = el('ul', 'tree');
  ids.forEach(function (id) {
    var li = el('li');
    li.append(renderNodeCard(id));
    var sub = treeList(DATA.nodes[id].children);
    if (sub.children.length) li.append(sub);
    ul.append(li);
  });
  return ul;
}

// A diagram on a pan-and-zoom surface, or a plain list when it could not be drawn.
function renderBoard() {
  var svg = S.view === 'tree' ? DATA.tree_svg : DATA.board_svg;
  var wrap = el('div', 'board');
  var canvas = svg ? makeCanvas(svg, { height: 'calc(100vh - 190px)', wheelZoom: true, label: S.view === 'tree' ? 'Tree' : 'Flow', onPick: function (id) { go({ node: diagramNodeId(DATA.nodes, id) }); } }) : null;
  if (canvas) {
    wrap.append(el('p', 'muted hint', 'Drag to move. Scroll to zoom. Click a box to open it.'), canvas);
  } else {
    wrap.append(el('p', 'muted hint', 'The diagram could not be drawn, so here is the plain list. Click a box to open it.'), treeList(DATA.roots));
  }
  return wrap;
}

// ---------- node page ----------

function section(title) {
  var s = el('section', 'sect');
  s.append(el('h3', null, title));
  return s;
}

function link(id) {
  var b = el('button', 'link', showId(DATA.project.key, id));
  b.type = 'button';
  b.addEventListener('click', function () { go({ node: id }); });
  return b;
}

function renderNodePage(id) {
  var n = DATA.nodes[id];
  var page = el('div', 'node-page');
  var bar = el('div', 'bar');
  var back = el('button', 'link back', '\u2190 Back to ' + (S.view === 'tree' ? 'tree' : 'flow'));
  back.type = 'button';
  back.dataset.key = 'back';
  back.addEventListener('click', function () { go({ node: null }); });
  bar.append(back, el('span', 'muted', DATA.project.shown));
  page.append(bar);

  page.append(el('h1', null, n.title));
  var line = el('p', 'muted');
  line.append(renderTags(n), document.createTextNode(' \u00b7 ' + n.kind));
  if (n.parent) { line.append(document.createTextNode(' \u00b7 part of ')); line.append(link(n.parent)); }
  page.append(line);

  var flow = section('Planned flow');
  var canvas = n.flow_svg ? makeCanvas(n.flow_svg, { height: '260px', wheelZoom: false, label: 'Sub-steps of ' + n.title, onPick: function (cid) { go({ node: cid }); } }) : null;
  if (canvas) flow.append(canvas);
  else flow.append(el('p', 'muted', n.children.length ? 'The diagram could not be drawn.' : 'No sub-steps yet.'));
  page.append(flow);

  var who = section('Who wrote it');
  if (n.source === 'human') who.append(el('p', null, 'Typed by you'));
  else if (n.source === 'ai-draft') {
    who.append(el('p', null, 'Drafted by Claude because you asked:'));
    n.said.forEach(function (q) { who.append(el('blockquote', null, q)); });
    if (n.state !== 'approved') who.append(el('p', 'muted', 'An AI draft: you have not approved it yet.'));
  } else {
    who.append(el('p', null, 'Recorded by the AI from your words:'));
    n.said.forEach(function (q) { who.append(el('blockquote', null, q)); });
  }
  page.append(who);


  var d = section('Description');
  d.append(el('p', n.description ? null : 'muted', n.description || 'not set'));
  page.append(d);

  var c = section('Contract');
  var dl = el('dl');
  ['input', 'output', 'check', 'limits'].forEach(function (k) {
    dl.append(el('dt', null, k));
    dl.append(el('dd', n.contract[k] ? null : 'muted', n.contract[k] || 'not set'));
  });
  c.append(dl);
  page.append(c);

  var g = section('Gaps');
  if (!n.gaps.length) g.append(el('p', 'muted', 'No gaps.'));
  n.gaps.forEach(function (gap) {
    var box = el('div', 'gap' + (gap.status === 'open' ? '' : ' closed'));
    box.append(el('p', null, showId(DATA.project.key, gap.id) + ' [' + gap.status + '] ' + (gap.kind ? '(' + gap.kind + ') ' : '') + gap.missing + (gap.where ? ' (' + gap.where + ')' : '')));
    if (gap.note) box.append(el('p', 'muted', 'Note: ' + gap.note));
    g.append(box);
  });
  page.append(g);

  if (n.superseded) {
    var s = section('Superseded');
    s.append(el('p', null, 'Reason: ' + n.superseded.reason));
    if (n.superseded.by) { var p = el('p', null, 'Replaced by '); p.append(link(n.superseded.by)); s.append(p); }
    if (n.superseded.cascade_from) { var q = el('p', null, 'Superseded together with '); q.append(link(n.superseded.cascade_from)); s.append(q); }
    page.append(s);
  }

  var h = section('History');
  var ol = el('ol', 'history');
  n.history.forEach(function (e) {
    ol.append(el('li', null, '#' + e.seq + ' ' + when(e.at) + ' \u00b7 ' + e.actor + ' ' + e.action + (e.summary ? ' \u00b7 ' + e.summary : '')));
  });
  h.append(ol);
  page.append(h);
  return page;
}

// ---------- draw ----------

// Redraws the whole page and puts keyboard focus back where it was.
function draw() {
  var app = document.getElementById('app');
  var keep = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.key : null;
  app.replaceChildren();
  if (S.node) {
    app.append(renderNodePage(S.node));
  } else {
    app.append(renderHeader(), renderBoard());
  }
  if (keep) {
    var again = Array.prototype.filter.call(app.querySelectorAll('[data-key]'), function (e) { return e.dataset.key === keep; })[0];
    if (again) again.focus();
  }
}

window.addEventListener('hashchange', function () { readHash(); draw(); });
readHash();
draw();
