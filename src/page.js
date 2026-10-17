// Draws the board from the embedded data. Display only: every rule was applied in Node.
// Classic script, plain functions. The DOM is built with createElement and textContent only.
var DATA = JSON.parse(document.getElementById('data').textContent);
var STATE_LABEL = { approved: 'Approved', has_gaps: 'Has gaps', drafting: 'Drafting', superseded: 'Superseded' };
var S = { view: 'flow', node: null, sup: true }; // what the page is showing

// Makes an element, optionally with a class and text.
function el(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
function isDropped(id) { return DATA.nodes[id].state === 'superseded'; }
function when(iso) { return new Date(iso).toLocaleString(); }

// ---------- state in the URL hash ----------

function readHash() {
  var p = new URLSearchParams(location.hash.slice(1));
  var n = p.get('node');
  S.view = p.get('view') === 'tree' ? 'tree' : 'flow';
  S.node = n && DATA.nodes[n] ? n : null;
  S.sup = p.get('sup') !== '0';
}

function writeHash() {
  var p = new URLSearchParams();
  p.set('view', S.view);
  if (S.node) p.set('node', S.node);
  if (!S.sup) p.set('sup', '0');
  try { history.replaceState(null, '', '#' + p.toString()); } catch (e) { location.hash = p.toString(); }
}

// Changes the page state, remembers it in the hash, redraws.
function go(change) {
  for (var k in change) S[k] = change[k];
  writeHash();
  draw();
}

// ---------- pieces ----------

function renderHeader() {
  var h = el('header', 'top');
  var c = DATA.counts;
  h.append(el('h1', null, DATA.project.name));
  h.append(el('p', 'meta', 'Last updated ' + when(DATA.generated_at)));
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
    b.addEventListener('click', function () { go({ view: v }); });
    tabs.append(b);
  });
  h.append(tabs);
  h.append(el('p', 'muted', 'Read-only. Decide in the terminal.'));
  return h;
}

// One node as a card. Used by both views.
function renderNodeCard(id) {
  var n = DATA.nodes[id];
  var b = el('button', 'card state-' + n.state + (S.node === id ? ' selected' : ''));
  b.type = 'button';
  b.dataset.key = 'card:' + id;
  b.setAttribute('aria-pressed', String(S.node === id));
  b.append(el('span', 'card-title', n.title));
  b.append(el('span', 'card-state', STATE_LABEL[n.state] + ' · ' + id));
  if (n.active_children) b.append(el('span', 'card-sub', plural(n.active_children, 'sub-problem')));
  if (n.open_gaps) b.append(el('span', 'card-sub', plural(n.open_gaps, 'open gap')));
  b.addEventListener('click', function () { go({ node: S.node === id ? null : id }); });
  return b;
}

function pill(text, label, col) {
  var p = el('div', 'pill', text);
  p.setAttribute('aria-label', label + ': ' + text);
  p.style.gridColumn = String(col);
  p.style.gridRow = '1';
  return p;
}

// The flow: input -> live boxes -> output, with dropped boxes in a separate row below.
function renderFlow() {
  var live = DATA.roots.filter(function (id) { return !isDropped(id); });
  var col = 1, colOf = {};
  var wrap = el('div', 'flow');
  var grid = el('div', 'flow-grid');
  if (DATA.project.input) grid.append(pill(DATA.project.input, 'Project input', col++));
  var firstBox = col;
  live.forEach(function (id) {
    var item = el('div', 'flow-item');
    item.style.gridColumn = String(col);
    item.style.gridRow = '1';
    item.append(renderNodeCard(id));
    colOf[id] = col++;
    grid.append(item);
  });
  var lastBox = Math.max(1, col - 1);
  if (DATA.project.output) grid.append(pill(DATA.project.output, 'Project output', col++));
  var total = Math.max(1, col - 1);
  // Dropped boxes sit under the next live box in order (or the last box column).
  var groups = {};
  DATA.roots.forEach(function (id, i) {
    if (!isDropped(id)) return;
    var next = DATA.roots.slice(i + 1).filter(function (x) { return !isDropped(x); })[0];
    var c = next ? colOf[next] : lastBox;
    (groups[c] = groups[c] || []).push(id);
  });
  if (Object.keys(groups).length) {
    var label = el('h2', 'dropped-label', 'Dropped');
    label.style.gridRow = '2';
    label.style.gridColumn = '1 / -1';
    grid.append(label);
    Object.keys(groups).forEach(function (c) {
      var g = el('div', 'dropped-group');
      g.style.gridColumn = c;
      g.style.gridRow = '3';
      groups[c].forEach(function (id) {
        g.append(renderNodeCard(id));
        var why = DATA.nodes[id].superseded;
        g.append(el('p', 'reason', why ? why.reason : ''));
      });
      grid.append(g);
    });
  }
  grid.style.gridTemplateColumns = 'repeat(' + total + ', 172px)';
  wrap.append(grid);
  return wrap;
}

// Sibling ids with live nodes first, dropped ones at the end (hidden if asked).
function treeOrder(ids) {
  var live = ids.filter(function (id) { return !isDropped(id); });
  var dead = S.sup ? ids.filter(isDropped) : [];
  return live.concat(dead);
}

function treeList(ids) {
  var ul = el('ul', 'tree');
  treeOrder(ids).forEach(function (id) {
    var li = el('li');
    li.append(renderNodeCard(id));
    var sub = treeList(DATA.nodes[id].children);
    if (sub.children.length) li.append(sub);
    ul.append(li);
  });
  return ul;
}

function renderTree() {
  var w = el('div', 'tree-wrap');
  var lab = el('label', 'toggle');
  var cb = el('input');
  cb.type = 'checkbox';
  cb.checked = S.sup;
  cb.dataset.key = 'sup';
  cb.addEventListener('change', function () { go({ sup: cb.checked }); });
  lab.append(cb, ' Show superseded');
  w.append(lab, el('div', 'tree-root', DATA.project.name), treeList(DATA.roots));
  return w;
}

// ---------- detail panel ----------

function section(title) {
  var s = el('section', 'sect');
  s.append(el('h3', null, title));
  return s;
}

function chip(text) { return el('code', 'chip', text); }

function link(id) {
  var b = el('button', 'link', id);
  b.type = 'button';
  b.addEventListener('click', function () { go({ node: id }); });
  return b;
}

function renderDetail(id) {
  var a = el('aside', 'detail');
  a.setAttribute('aria-label', 'Node details');
  if (!id) { a.append(el('p', 'muted', 'Select a node to see its details.')); return a; }
  var n = DATA.nodes[id];
  a.append(el('h2', null, n.title));
  var line = el('p', 'muted', n.id + ' · ' + n.kind + ' · ');
  line.append(el('span', 'badge state-' + n.state, STATE_LABEL[n.state]));
  a.append(line);

  var who = section('Who wrote it');
  if (n.source === 'human') who.append(el('p', null, 'Typed by you'));
  else {
    who.append(el('p', null, 'Recorded by the AI from your words:'));
    n.said.forEach(function (q) { who.append(el('blockquote', null, q)); });
  }
  a.append(who);

  var d = section('Description');
  d.append(el('p', n.description ? null : 'muted', n.description || 'not set'));
  a.append(d);

  var c = section('Contract');
  var dl = el('dl');
  ['input', 'output', 'check', 'limits'].forEach(function (k) {
    dl.append(el('dt', null, k));
    dl.append(el('dd', n.contract[k] ? null : 'muted', n.contract[k] || 'not set'));
  });
  c.append(dl);
  a.append(c);

  var g = section('Gaps');
  if (!n.gaps.length) g.append(el('p', 'muted', 'No gaps.'));
  n.gaps.forEach(function (gap) {
    var box = el('div', 'gap' + (gap.status === 'open' ? '' : ' closed'));
    box.append(el('p', null, gap.id + ' [' + gap.status + '] ' + gap.missing + (gap.where ? ' (' + gap.where + ')' : '')));
    if (gap.note) box.append(el('p', 'muted', 'Note: ' + gap.note));
    if (gap.status === 'open') gap.commands.forEach(function (cmd) { box.append(chip(cmd)); });
    g.append(box);
  });
  a.append(g);

  if (n.superseded) {
    var s = section('Superseded');
    s.append(el('p', null, 'Reason: ' + n.superseded.reason));
    if (n.superseded.by) { var p = el('p', null, 'Replaced by '); p.append(link(n.superseded.by)); s.append(p); }
    if (n.superseded.cascade_from) { var q = el('p', null, 'Superseded together with '); q.append(link(n.superseded.cascade_from)); s.append(q); }
    a.append(s);
  }

  var h = section('History');
  var ol = el('ol', 'history');
  n.history.forEach(function (e) {
    ol.append(el('li', null, '#' + e.seq + ' ' + when(e.at) + ' · ' + e.actor + ' ' + e.action + (e.summary ? ' · ' + e.summary : '')));
  });
  h.append(ol);
  a.append(h);

  var nx = section('Next commands');
  if (!n.next_commands.length) nx.append(el('p', 'muted', 'None. Restore the parent that was superseded with it.'));
  n.next_commands.forEach(function (cmd) { nx.append(chip(cmd)); });
  a.append(nx);
  return a;
}

// ---------- draw ----------

// Redraws the whole page and puts keyboard focus back where it was.
function draw() {
  var app = document.getElementById('app');
  var keep = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.key : null;
  app.replaceChildren();
  app.append(renderHeader());
  var main = el('div', 'main');
  var left = el('div', 'view');
  left.append(S.view === 'tree' ? renderTree() : renderFlow());
  main.append(left, renderDetail(S.node));
  app.append(main);
  if (keep) {
    var again = Array.prototype.filter.call(app.querySelectorAll('[data-key]'), function (e) { return e.dataset.key === keep; })[0];
    if (again) again.focus();
  }
}

window.addEventListener('hashchange', function () { readHash(); draw(); });
readHash();
draw();
