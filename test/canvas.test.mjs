import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

// canvas.js is a classic browser script: run it in a vm and use its plain functions.
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.resolve('src/canvas.js'), 'utf8'), ctx);
const { canvasFit, canvasZoom, canvasPan, canvasClamp, canvasScale } = ctx;
const BOX = { w: 1000, h: 500 };

test('fit: a small diagram is centred and not blown up past 1.2x', () => {
  const v = canvasFit({ w: 400, h: 88 }, BOX);
  assert.ok(Math.abs(canvasScale(v, BOX) - 1.2) < 1e-9);
  assert.ok(Math.abs((v.x + v.w / 2) - 200) < 1e-6, 'centred across');
  assert.ok(Math.abs((v.y + v.h / 2) - 44) < 1e-6, 'centred down');
});

test('fit: a diagram that fits shows all of it', () => {
  const v = canvasFit({ w: 1800, h: 600 }, BOX);
  assert.ok(v.x <= 0 && v.x + v.w >= 1800);
  assert.ok(v.y <= 0 && v.y + v.h >= 600);
});

test('fit: a very wide diagram stays readable and starts at the left', () => {
  const v = canvasFit({ w: 6890, h: 88 }, BOX);
  assert.ok(canvasScale(v, BOX) >= 0.5 - 1e-9, 'not smaller than the readable limit');
  assert.ok(v.x < 0 && v.x > -50, 'left edge with a small margin');
});

test('fit: a very tall diagram starts at the top', () => {
  const v = canvasFit({ w: 200, h: 3568 }, BOX);
  assert.ok(canvasScale(v, BOX) >= 0.5 - 1e-9);
  assert.ok(v.y < 0 && v.y > -50);
});

test('the view always has the same shape as the box', () => {
  for (const nat of [{ w: 400, h: 88 }, { w: 6890, h: 88 }, { w: 200, h: 3568 }]) {
    const v = canvasFit(nat, BOX);
    assert.ok(Math.abs(v.w / v.h - BOX.w / BOX.h) < 1e-9);
  }
});

test('zoom keeps the point under the pointer still', () => {
  const v = canvasFit({ w: 1800, h: 600 }, BOX);
  const px = 300, py = 120, s = canvasScale(v, BOX);
  const before = { x: v.x + px / s, y: v.y + py / s };
  const z = canvasZoom(v, BOX, 1.5, px, py);
  const s2 = canvasScale(z, BOX);
  assert.ok(Math.abs(s2 - s * 1.5) < 1e-9);
  assert.ok(Math.abs(z.x + px / s2 - before.x) < 1e-6);
  assert.ok(Math.abs(z.y + py / s2 - before.y) < 1e-6);
});

test('zoom is limited to between 0.15x and 4x', () => {
  const v = canvasFit({ w: 1800, h: 600 }, BOX);
  assert.ok(Math.abs(canvasScale(canvasZoom(v, BOX, 1000, 0, 0), BOX) - 4) < 1e-9);
  assert.ok(Math.abs(canvasScale(canvasZoom(v, BOX, 0.0001, 0, 0), BOX) - 0.15) < 1e-9);
});

test('pan: dragging right by 100 px moves the view left by 100 px of diagram', () => {
  const v = { x: 0, y: 0, w: 1000, h: 500 };
  const p = canvasPan(v, BOX, 100, 40);
  assert.equal(p.x, -100);
  assert.equal(p.y, -40);
  assert.equal(p.w, 1000);
});

test('clamp: the diagram cannot be dragged out of sight', () => {
  const nat = { w: 1800, h: 600 };
  const far = canvasClamp({ x: 99999, y: -99999, w: 1000, h: 500 }, nat, BOX);
  assert.ok(far.x < nat.w, 'still overlaps across');
  assert.ok(far.y + far.h > 0, 'still overlaps down');
});
