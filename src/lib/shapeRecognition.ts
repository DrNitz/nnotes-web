/**
 * Port of Nnotes `core/stroke/ShapeRecognizer.kt` — freehand stroke to a clean shape.
 * Thresholds are fractions of the bounding-box diagonal, so recognition is zoom-independent.
 */
import type { Pt, ShapeKind } from '../types/model';

export interface RecognizedShape {
  kind: ShapeKind;
  start: Pt;
  end: Pt;
  vertices?: Pt[];
}

const MIN_POINTS = 8;
const MIN_DIAGONAL = 24;
const CLOSED_GAP_FRAC = 0.22;
const LINE_DEV_FRAC = 0.08;
const RESAMPLE_N = 64;
const ELLIPSE_RESIDUAL_FRAC = 0.11;
const CORNER_ANGLE_RAD = (50 * Math.PI) / 180;
const SHARP_CORNER_RAD = (42 * Math.PI) / 180;
const CIRCLE_ASPECT_MIN = 0.8;
const RECT_CORNER_FRAC = 0.12;
const AXIS_SNAP_RAD = (8 * Math.PI) / 180;
const EDGE_DEV_FRAC = 0.06;
const MAX_POLY_VERTS = 12;

const len = (u: Pt, v: Pt) => Math.hypot(v[0] - u[0], v[1] - u[1]);
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const distToSegment = (p: Pt, a: Pt, b: Pt): number => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-12) return len(p, a);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
};

function bounding(points: Pt[]) {
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const left = Math.min(...xs), top = Math.min(...ys);
  return { left, top, right: Math.max(...xs), bottom: Math.max(...ys), w: Math.max(...xs) - left, h: Math.max(...ys) - top };
}

function pathLength(points: Pt[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += len(points[i - 1], points[i]);
  return total;
}

/** Classic arc-length resampling to exactly `n` evenly-spaced points. */
export function resample(points: Pt[], n: number): Pt[] {
  if (points.length <= 1 || n <= 1) return points;
  const total = pathLength(points);
  if (total < 1e-9) return Array(n).fill(points[0]);
  const step = total / (n - 1);
  const out: Pt[] = [points[0]];
  let prev = points[0];
  let accum = 0;
  let i = 1;
  while (i < points.length && out.length < n) {
    const curr = points[i];
    const seg = len(prev, curr);
    if (seg < 1e-12) { i++; continue; }
    if (accum + seg >= step) {
      const t = (step - accum) / seg;
      const np: Pt = [prev[0] + t * (curr[0] - prev[0]), prev[1] + t * (curr[1] - prev[1])];
      out.push(np);
      prev = np;
      accum = 0;
    } else {
      accum += seg;
      prev = curr;
      i++;
    }
  }
  while (out.length < n) out.push(points[points.length - 1]);
  return out;
}

function angleBetween(u: Pt, v: Pt): number {
  const lu = Math.hypot(u[0], u[1]);
  const lv = Math.hypot(v[0], v[1]);
  if (lu < 1e-9 || lv < 1e-9) return 0;
  return Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (lu * lv))));
}

function cornerPeaks(path: Pt[], wrap: boolean): number[] {
  const n = path.length;
  if (n < 8) return [];
  const k = Math.max(2, Math.floor(n / 12));
  const turns = path.map((cur, i) => {
    if (!wrap && (i - k < 0 || i + k >= n)) return 0;
    const prev = path[(i - k + n) % n];
    const next = path[(i + k) % n];
    return angleBetween(sub(cur, prev), sub(next, cur));
  });
  let startAt = 0;
  if (wrap) for (let i = 1; i < n; i++) if (turns[i] < turns[startAt]) startAt = i;
  const peaks: number[] = [];
  let i = 0;
  while (i < n) {
    const gi = (startAt + i) % n;
    if (turns[gi] >= CORNER_ANGLE_RAD) {
      let bestIdx = gi, bestTurn = turns[gi];
      i++;
      while (i < n) {
        const gj = (startAt + i) % n;
        if (turns[gj] < CORNER_ANGLE_RAD) break;
        if (turns[gj] > bestTurn) { bestTurn = turns[gj]; bestIdx = gj; }
        i++;
      }
      peaks.push(bestIdx);
    } else i++;
  }
  return peaks.filter((idx) => {
    const kt = 2;
    if (!wrap && (idx - kt < 0 || idx + kt >= n)) return true;
    const prev = path[(idx - kt + n) % n];
    const next = path[(idx + kt) % n];
    return angleBetween(sub(path[idx], prev), sub(next, path[idx])) >= SHARP_CORNER_RAD;
  }).sort((a, b) => a - b);
}

function edgesStraight(path: Pt[], vertIdx: number[], wrap: boolean, diag: number): boolean {
  const n = path.length, m = vertIdx.length;
  if (m < 2) return false;
  const tol = EDGE_DEV_FRAC * diag;
  const edges = wrap ? m : m - 1;
  for (let e = 0; e < edges; e++) {
    const a = path[vertIdx[e]], b = path[vertIdx[(e + 1) % m]];
    let j = vertIdx[e];
    while (j !== vertIdx[(e + 1) % m]) {
      if (distToSegment(path[j], a, b) > tol) return false;
      j = (j + 1) % n;
      if (!wrap && j === 0) break;
    }
  }
  return true;
}

function find(group: number[], i: number): number {
  let root = i;
  while (group[root] !== root) root = group[root];
  let cur = i;
  while (group[cur] !== cur) { const next = group[cur]; group[cur] = root; cur = next; }
  return root;
}
function union(group: number[], a: number, b: number) { group[find(group, a)] = find(group, b); }

/** Straighten edges near horizontal/vertical, sharing the move across joined vertices. */
function snapAxisAligned(verts: Pt[], closed: boolean): Pt[] {
  const m = verts.length;
  if (m < 2) return verts;
  const xGroup = verts.map((_, i) => i);
  const yGroup = verts.map((_, i) => i);
  const edges = closed ? m : m - 1;
  for (let e = 0; e < edges; e++) {
    const a = verts[e], b = verts[(e + 1) % m];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    if (Math.hypot(dx, dy) < 1e-9) continue;
    const fromHoriz = Math.atan2(Math.abs(dy), Math.abs(dx));
    if (fromHoriz <= AXIS_SNAP_RAD) union(yGroup, e, (e + 1) % m);
    else if (fromHoriz >= Math.PI / 2 - AXIS_SNAP_RAD) union(xGroup, e, (e + 1) % m);
  }
  const means = (group: number[], coord: 0 | 1) => {
    const sum = new Map<number, number>(), count = new Map<number, number>();
    verts.forEach((v, i) => { const r = find(group, i); sum.set(r, (sum.get(r) ?? 0) + v[coord]); count.set(r, (count.get(r) ?? 0) + 1); });
    return verts.map((_, i) => (sum.get(find(group, i)) ?? 0) / (count.get(find(group, i)) ?? 1));
  };
  const xs = means(xGroup, 0), ys = means(yGroup, 1);
  return verts.map((_, i) => [xs[i], ys[i]] as Pt);
}

function ellipseResidual(loop: Pt[], b: ReturnType<typeof bounding>): number {
  const cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2;
  const rx = Math.max(1e-6, b.w / 2), ry = Math.max(1e-6, b.h / 2);
  let sumSq = 0;
  for (const p of loop) {
    const nx = (p[0] - cx) / rx, ny = (p[1] - cy) / ry;
    const d = Math.hypot(nx, ny) - 1;
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / loop.length);
}

function ellipseOrCircle(b: ReturnType<typeof bounding>): RecognizedShape {
  const long = Math.max(b.w, b.h), short = Math.min(b.w, b.h);
  const aspect = long > 1e-9 ? short / long : 1;
  if (aspect < CIRCLE_ASPECT_MIN) return { kind: 'ellipse', start: [b.left, b.top], end: [b.right, b.bottom] };
  const r = (b.w + b.h) / 4;
  const cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2;
  return { kind: 'ellipse', start: [cx - r, cy - r], end: [cx + r, cy + r] };
}

function isAxisAlignedRect(verts: Pt[], b: ReturnType<typeof bounding>, diag: number): boolean {
  const corners: Pt[] = [[b.left, b.top], [b.right, b.top], [b.right, b.bottom], [b.left, b.bottom]];
  const tol = RECT_CORNER_FRAC * diag;
  const used = [false, false, false, false];
  for (const v of verts) {
    let best = -1, bestD = Infinity;
    for (let c = 0; c < 4; c++) {
      if (used[c]) continue;
      const d = len(v, corners[c]);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best < 0 || bestD > tol) return false;
    used[best] = true;
  }
  return true;
}

export function recognizeShape(points: Pt[]): RecognizedShape | null {
  if (points.length < MIN_POINTS) return null;
  const b = bounding(points);
  const diag = Math.hypot(b.w, b.h);
  if (diag < MIN_DIAGONAL) return null;

  const closed = len(points[0], points[points.length - 1]) <= CLOSED_GAP_FRAC * diag;
  if (!closed) {
    const chord = len(points[0], points[points.length - 1]);
    if (chord > 1e-6) {
      const maxDev = Math.max(...points.map((p) => distToSegment(p, points[0], points[points.length - 1])));
      if (maxDev / chord <= LINE_DEV_FRAC) {
        const ends = snapAxisAligned([points[0], points[points.length - 1]], false);
        return { kind: 'line', start: ends[0], end: ends[1] };
      }
    }
    const path = resample(points, RESAMPLE_N);
    const peaks = cornerPeaks(path, false);
    if (peaks.length && peaks.length <= MAX_POLY_VERTS) {
      const vertIdx = [0, ...peaks, path.length - 1];
      if (edgesStraight(path, vertIdx, false, diag)) {
        const verts = snapAxisAligned(vertIdx.map((i) => path[i]), false);
        const vb = bounding(verts);
        return { kind: 'polyline', start: [vb.left, vb.top], end: [vb.right, vb.bottom], vertices: verts };
      }
    }
    // Smooth freehand curves stay as a dense polyline; a single cubic fit would be a closer
    // approximation, but preserving the sampled path keeps the gesture lossless.
    return { kind: 'curve', start: [b.left, b.top], end: [b.right, b.bottom], vertices: resample(points, 48) };
  }

  const loop = resample([...points, points[0]], RESAMPLE_N + 1).slice(0, RESAMPLE_N);
  const peaks = cornerPeaks(loop, true);
  if (peaks.length >= 3 && peaks.length <= MAX_POLY_VERTS && edgesStraight(loop, peaks, true, diag)) {
    const verts = peaks.map((i) => loop[i]);
    if (verts.length === 4 && isAxisAlignedRect(verts, b, diag)) {
      return { kind: 'rectangle', start: [b.left, b.top], end: [b.right, b.bottom] };
    }
    const snapped = snapAxisAligned(verts, true);
    const vb = bounding(snapped);
    return { kind: 'polygon', start: [vb.left, vb.top], end: [vb.right, vb.bottom], vertices: snapped };
  }
  if (ellipseResidual(loop, b) <= ELLIPSE_RESIDUAL_FRAC) return ellipseOrCircle(b);
  return null;
}
