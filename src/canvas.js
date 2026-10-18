// A pan-and-zoom surface for an SVG diagram. Classic script, plain functions, no dependencies.
// A "view" is the part of the diagram on screen, in diagram units: { x, y, w, h }.
// A "box" is the size of the screen area in pixels: { w, h }. The view always has the box's shape.
var CANVAS_MIN_READABLE = 0.5; // below this, text gets too small to read, so a long diagram is panned instead
var CANVAS_MAX_FIT = 1.2;      // small diagrams are not blown up past this
var CANVAS_MIN = 0.15;
var CANVAS_MAX = 4;
var CANVAS_PAD = 16;           // pixels of margin when fitting

function canvasScale(view, box) { return box.w / view.w; }

function canvasView(x, y, scale, box) { return { x: x, y: y, w: box.w / scale, h: box.h / scale }; }

// The first view: everything, centred, unless that would be too small to read; then it starts at the top left.
function canvasFit(nat, box) {
  var fit = Math.min((box.w - 2 * CANVAS_PAD) / nat.w, (box.h - 2 * CANVAS_PAD) / nat.h);
  var s = Math.min(Math.max(fit, CANVAS_MIN_READABLE), CANVAS_MAX_FIT);
  var v = canvasView(0, 0, s, box);
  v.x = nat.w * s > box.w - 2 * CANVAS_PAD ? -CANVAS_PAD / s : (nat.w - v.w) / 2;
  v.y = nat.h * s > box.h - 2 * CANVAS_PAD ? -CANVAS_PAD / s : (nat.h - v.h) / 2;
  return v;
}

// Zoom by a factor around a pixel position, so the point under the pointer stays where it is.
function canvasZoom(view, box, factor, px, py) {
  var s = canvasScale(view, box);
  var t = Math.min(CANVAS_MAX, Math.max(CANVAS_MIN, s * factor));
  return canvasView(view.x + px / s - px / t, view.y + py / s - py / t, t, box);
}

// Move the view as if the diagram were dragged by dx, dy pixels.
function canvasPan(view, box, dx, dy) {
  var s = canvasScale(view, box);
  return { x: view.x - dx / s, y: view.y - dy / s, w: view.w, h: view.h };
}

// Keeps at least a sliver of the diagram on screen.
function canvasClamp(view, nat, box) {
  var keepX = view.w * 0.15, keepY = view.h * 0.15;
  return {
    x: Math.min(nat.w - keepX, Math.max(keepX - view.w, view.x)),
    y: Math.min(nat.h - keepY, Math.max(keepY - view.h, view.y)),
    w: view.w, h: view.h,
  };
}

// ---------- the element ----------

function canvasTool(text, label, act) {
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'canvas-tool';
  b.textContent = text;
  b.setAttribute('aria-label', label);
  b.addEventListener('click', act);
  return b;
}

// Parses pele's SVG text into a node of this page. Returns null if it is not a usable SVG.
function canvasParse(svgText) {
  var doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  var root = doc.documentElement;
  if (!root || root.nodeName !== 'svg' || doc.getElementsByTagName('parsererror').length) return null;
  var svg = document.importNode(root, true);
  Array.prototype.forEach.call(svg.querySelectorAll('script, foreignObject'), function (n) { n.remove(); });
  Array.prototype.forEach.call(svg.querySelectorAll('*'), function (n) {
    Array.prototype.slice.call(n.attributes).forEach(function (a) { if (/^on/i.test(a.name)) n.removeAttribute(a.name); });
  });
  var vb = (svg.getAttribute('viewBox') || '').split(/[ ,]+/).map(Number);
  if (vb.length !== 4 || vb.some(isNaN) || vb[2] <= 0 || vb[3] <= 0) return null;
  return { svg: svg, nat: { w: vb[2], h: vb[3] } };
}

// Builds the surface. opts: { height: '70vh', wheelZoom: true, label: 'text', onPick: function (id) }.
// Returns the element, or null when the SVG cannot be used.
function makeCanvas(svgText, opts) {
  var parsed = canvasParse(svgText);
  if (!parsed) return null;
  var svg = parsed.svg, nat = parsed.nat;
  var wrap = document.createElement('div');
  wrap.className = 'canvas';
  wrap.style.height = opts.height || '70vh';
  wrap.tabIndex = 0;
  wrap.setAttribute('role', 'group');
  wrap.setAttribute('aria-label', (opts.label || 'Diagram') + '. Drag to move, scroll or use plus and minus to zoom.');

  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.maxWidth = 'none';
  Array.prototype.forEach.call(svg.querySelectorAll('.pele-node'), function (g) {
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'link');
    var lines = Array.prototype.map.call(g.querySelectorAll('tspan'), function (t) { return t.textContent; });
    g.setAttribute('aria-label', (lines.length ? lines.join(', ') : g.textContent || '').replace(/\s+/g, ' ').trim());
  });

  var box = { w: 0, h: 0 }, view = { x: 0, y: 0, w: 1, h: 1 }, touched = false;
  function apply() { svg.setAttribute('viewBox', view.x + ' ' + view.y + ' ' + view.w + ' ' + view.h); }
  function set(next) { view = canvasClamp(next, nat, box); touched = true; apply(); }
  function layout() {
    var r = wrap.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    var s = touched ? canvasScale(view, box) : 0;
    box = { w: r.width, h: r.height };
    view = touched ? canvasView(view.x, view.y, s, box) : canvasFit(nat, box);
    apply();
  }
  function zoom(f) { set(canvasZoom(view, box, f, box.w / 2, box.h / 2)); }
  function fit() { touched = false; layout(); }

  var tools = document.createElement('div');
  tools.className = 'canvas-tools';
  tools.append(canvasTool('+', 'Zoom in', function () { zoom(1.25); }),
    canvasTool('−', 'Zoom out', function () { zoom(0.8); }),
    canvasTool('Fit', 'Fit the diagram', fit));
  wrap.append(svg, tools);

  function nodeOf(target) { return target && target.closest ? target.closest('.pele-node') : null; }
  var down = null;
  wrap.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || (e.target.closest && e.target.closest('.canvas-tools'))) return;
    down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, node: nodeOf(e.target) };
    try { wrap.setPointerCapture(e.pointerId); } catch (err) { /* not every pointer can be captured */ }
  });
  wrap.addEventListener('pointermove', function (e) {
    if (!down) return;
    if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) return;
    if (!down.moved) wrap.classList.add('dragging');
    down.moved = true;
    set(canvasPan(view, box, e.clientX - down.lx, e.clientY - down.ly));
    down.lx = e.clientX; down.ly = e.clientY;
  });
  function release() { wrap.classList.remove('dragging'); down = null; }
  wrap.addEventListener('pointerup', function () {
    var hit = down && !down.moved ? down.node : null;
    release();
    if (hit && opts.onPick) opts.onPick(hit.getAttribute('data-id'));
  });
  wrap.addEventListener('pointercancel', release);
  wrap.addEventListener('wheel', function (e) {
    if (opts.wheelZoom === false && !e.ctrlKey && !e.metaKey) return; // let the page scroll
    e.preventDefault();
    var r = wrap.getBoundingClientRect();
    set(canvasZoom(view, box, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top));
  }, { passive: false });
  wrap.addEventListener('keydown', function (e) {
    var node = nodeOf(e.target);
    if ((e.key === 'Enter' || e.key === ' ') && node) { e.preventDefault(); if (opts.onPick) opts.onPick(node.getAttribute('data-id')); return; }
    var step = 80, handled = true;
    if (e.key === '+' || e.key === '=') zoom(1.25);
    else if (e.key === '-' || e.key === '_') zoom(0.8);
    else if (e.key === '0') fit();
    else if (e.key === 'ArrowLeft') set(canvasPan(view, box, step, 0));
    else if (e.key === 'ArrowRight') set(canvasPan(view, box, -step, 0));
    else if (e.key === 'ArrowUp') set(canvasPan(view, box, 0, step));
    else if (e.key === 'ArrowDown') set(canvasPan(view, box, 0, -step));
    else handled = false;
    if (handled) e.preventDefault();
  });

  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(layout).observe(wrap);
  requestAnimationFrame(layout);
  return wrap;
}

// A box clicked in a diagram carries the Mermaid id (p1_1); map it back to the node id (p1.1).
function diagramNodeId(nodes, id) { return nodes[id] ? id : String(id).replace(/_/g, '.'); }

// An id with the board key in front, as shown to the person.
function showId(key, id) { return key ? key + '-' + id : id; }
