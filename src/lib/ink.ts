/**
 * Direct port of Nnotes `core/stroke/StrokeEngine.kt` — raw stylus samples to a
 * variable-width ink ribbon. Kept deterministic so `.nnote` samples reload identically.
 */
import type { Pt, StrokeSample, ToolConfig } from '../types/model';

export interface StrokeGeometry {
  outline: Pt[];
  centerline: Pt[];
  halfWidths: number[];
}

const ALPHA = 0.5;
const MIN_TANGENT_LEN = 1e-6;
const MIN_DIRECTION = 0.1;
const PRESSURE_CURVE_K = 8.0;
const DIR_ALPHA = 0.25;
const DIR_CONFIRM_LEN = 8.0;
const DOT_MAX_LEN = 5.0;
const DOT_DIR_Y = 1.5;
const SPEED_LO = 0.0;
const SPEED_HI = 0.6;
const SPEED_WINDOW_MS = 40.0;
const MIN_DT = 1.0;
const TAPER_MIN_LEN = 8.0;
const CAP_HOLD_SAMPLES = 4;
const TAPER_TAIL = 0.01;
const TAPER_CURVE_K = 2.0 * Math.log((1.0 - TAPER_TAIL) / TAPER_TAIL);

export function ema(values: number[], alpha = ALPHA): number[] {
  if (!values.length) return [];
  const out = new Array<number>(values.length);
  out[0] = values[0];
  for (let i = 1; i < values.length; i++) out[i] = alpha * values[i] + (1 - alpha) * out[i - 1];
  return out;
}

export function logisticEase(x: number, k: number): number {
  if (k <= 0) return x;
  const lo = 1 / (1 + Math.exp(k * 0.5));
  const hi = 1 / (1 + Math.exp(-k * 0.5));
  const raw = 1 / (1 + Math.exp(-k * (x - 0.5)));
  return (raw - lo) / (hi - lo);
}

function smoothstep(lo: number, hi: number, x: number): number {
  if (hi <= lo) return x >= hi ? 1 : 0;
  const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
}

function holdEndPressure(p: number[]): number[] {
  const n = p.length;
  const w = Math.min(CAP_HOLD_SAMPLES, Math.floor((n - 1) / 2));
  if (w < 1) return p;
  const out = p.slice();
  const headFloor = p[w];
  for (let i = 0; i < w; i++) if (out[i] < headFloor) out[i] = headFloor;
  const tailFloor = p[n - 1 - w];
  for (let i = n - w; i < n; i++) if (out[i] < tailFloor) out[i] = tailFloor;
  return out;
}

export function halfWidth(
  baseWidth: number,
  pressureEnabled: boolean,
  m: number,
  ds: number,
  pressure: number,
  ty: number,
): number {
  const pEff = pressureEnabled ? logisticEase(pressure, PRESSURE_CURVE_K) : 1;
  const wBase = baseWidth * (m + (1 - m) * pEff);
  const direction = Math.max(1 + ds * ty, MIN_DIRECTION);
  return (wBase * direction) / 2;
}

/** Sample timestamps; synthesize a distance-based clock for legacy samples without `t`. */
function times(samples: StrokeSample[]): number[] {
  if (samples.every((s) => s.length > 3)) return samples.map((s) => s[3] as number);
  let acc = 0;
  const out = [0];
  for (let i = 1; i < samples.length; i++) {
    acc += dist2(samples[i], samples[i - 1]);
    out.push(acc);
  }
  return out;
}

const dist2 = (a: StrokeSample, b: StrokeSample) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function speedFactors(samples: StrokeSample[], speedStrength: number, speedScale: number): number[] {
  const n = samples.length;
  if (speedStrength <= 0 || n < 2) return Array(n).fill(1);
  const ts = times(samples);
  const t0 = ts[0];
  const tN = ts[n - 1];
  if (tN - t0 <= 0) return Array(n).fill(1);
  const cum = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + dist2(samples[i], samples[i - 1]);

  const half = SPEED_WINDOW_MS;
  let lo = 0;
  let hi = 0;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    let a = ts[i] - half;
    let b = ts[i] + half;
    if (a < t0) { b += t0 - a; a = t0; }
    if (b > tN) { a -= b - tN; b = tN; if (a < t0) a = t0; }
    while (lo < i && ts[lo] < a) lo++;
    while (hi < n - 1 && ts[hi + 1] <= b) hi++;
    let l = lo;
    let h = hi;
    if (h <= l) { if (h < n - 1) h++; else l--; }
    const d = (cum[h] - cum[l]) * speedScale;
    const dt = Math.max(ts[h] - ts[l], MIN_DT);
    out.push(1 - speedStrength * smoothstep(SPEED_LO, SPEED_HI, d / dt));
  }
  return out;
}

export function taperFactors(centers: Pt[], taperEnabled: boolean, taperMinFactor: number): number[] {
  const n = centers.length;
  if (!taperEnabled || n < 2) return Array(n).fill(1);
  const cum = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(centers[i][0] - centers[i - 1][0], centers[i][1] - centers[i - 1][1]);
  const total = cum[n - 1];
  if (total < TAPER_MIN_LEN) return Array(n).fill(1);
  return cum.map((c) => {
    const edge = (total - c) / total;
    return taperMinFactor + (1 - taperMinFactor) * logisticEase(edge, TAPER_CURVE_K);
  });
}

function confirmThickening(ty: number[], centers: Pt[], window: number): number[] {
  const n = ty.length;
  if (n < 2) return ty;
  const cum = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(centers[i][0] - centers[i - 1][0], centers[i][1] - centers[i - 1][1]);

  const eroded = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let v = cum[i] < window ? -1 : ty[i];
    let j = i;
    while (j >= 0 && cum[i] - cum[j] <= window) { if (ty[j] < v) v = ty[j]; j--; }
    eroded[i] = v;
  }
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let v = eroded[i];
    let j = i;
    while (j < n && cum[j] - cum[i] <= window) { if (eroded[j] > v) v = eroded[j]; j++; }
    out[i] = v;
  }
  const confirm = cum.findIndex((c) => c >= window);
  if (confirm > 0) {
    const floor = eroded[confirm];
    for (let i = 0; i < confirm; i++) if (out[i] < floor) out[i] = floor;
  }
  return out;
}

export interface BuildOptions {
  speedStrength?: number;
  taperEnabled?: boolean;
  taperMinFactor?: number;
  speedScale?: number;
  smooth?: boolean;
  holdEnds?: boolean;
  finished?: boolean;
}

export function buildStrokeGeometry(samples: StrokeSample[], c: ToolConfig, opts: BuildOptions = {}): StrokeGeometry {
  const n = samples.length;
  if (!n) return { outline: [], centerline: [], halfWidths: [] };

  const smooth = opts.smooth ?? true;
  const holdEnds = opts.holdEnds ?? false;
  const finished = opts.finished ?? true;
  const speedStrength = opts.speedStrength ?? c.speed_strength ?? 0;
  const taperEnabled = opts.taperEnabled ?? c.taper_enabled ?? false;
  const taperMinFactor = opts.taperMinFactor ?? c.taper_min_factor ?? 0;
  const speedScale = opts.speedScale ?? 1;

  const sx = smooth ? ema(samples.map((s) => s[0])) : samples.map((s) => s[0]);
  const sy = smooth ? ema(samples.map((s) => s[1])) : samples.map((s) => s[1]);
  const rawPressure = ema(samples.map((s) => s[2]));
  const sp = holdEnds && c.pressure_enabled ? holdEndPressure(rawPressure) : rawPressure;
  const centers: Pt[] = samples.map((_, i) => [sx[i], sy[i]]);

  const pw = c.pressure_enabled ? c.pressure_min_factor : 1;
  const ds = c.direction_strength;
  const widthAt = (i: number, ty: number) => halfWidth(c.base_width, c.pressure_enabled, pw, ds, sp[i], ty);

  if (n === 1) {
    const h = widthAt(0, finished && ds > 0 ? DOT_DIR_Y : 0);
    return { outline: [], centerline: centers, halfWidths: [h] };
  }

  const tangents: Pt[] = [];
  let lastGood: Pt = [1, 0];
  for (let i = 0; i < n; i++) {
    const d: Pt = i === 0
      ? [centers[1][0] - centers[0][0], centers[1][1] - centers[0][1]]
      : i === n - 1
        ? [centers[i][0] - centers[i - 1][0], centers[i][1] - centers[i - 1][1]]
        : [centers[i + 1][0] - centers[i - 1][0], centers[i + 1][1] - centers[i - 1][1]];
    const len = Math.hypot(d[0], d[1]);
    if (len < MIN_TANGENT_LEN) tangents.push(lastGood);
    else { lastGood = [d[0] / len, d[1] / len]; tangents.push(lastGood); }
  }

  const sf = speedFactors(samples, speedStrength, speedScale);
  const tf = taperFactors(centers, taperEnabled, taperMinFactor);

  let dirY: number[] | null = null;
  if (ds > 0) {
    let arc = 0;
    for (let i = 1; i < n; i++) arc += Math.hypot(centers[i][0] - centers[i - 1][0], centers[i][1] - centers[i - 1][1]);
    dirY = finished && arc <= DOT_MAX_LEN
      ? Array(n).fill(DOT_DIR_Y)
      : ema(confirmThickening(tangents.map((t) => t[1]), centers, DIR_CONFIRM_LEN), DIR_ALPHA);
  }

  const left: Pt[] = [];
  const right: Pt[] = [];
  const halfWidths: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = tangents[i];
    const h = widthAt(i, dirY ? dirY[i] : t[1]) * sf[i] * tf[i];
    halfWidths.push(h);
    const normal: Pt = [-t[1], t[0]];
    left.push([centers[i][0] - normal[0] * h, centers[i][1] - normal[1] * h]);
    right.push([centers[i][0] + normal[0] * h, centers[i][1] + normal[1] * h]);
  }

  const outline = [...left, ...right.slice().reverse()];
  return { outline: outline.length >= 3 ? outline : [], centerline: centers, halfWidths };
}

/** Outline polygon plus a swept disc at every sample (round caps and joins). */
export function strokePath(g: StrokeGeometry): Path2D {
  const path = new Path2D();
  if (g.outline.length >= 3) {
    path.moveTo(g.outline[0][0], g.outline[0][1]);
    for (let i = 1; i < g.outline.length; i++) path.lineTo(g.outline[i][0], g.outline[i][1]);
    path.closePath();
  }
  for (let i = 0; i < g.centerline.length; i++) {
    const [x, y] = g.centerline[i];
    path.moveTo(x + g.halfWidths[i], y);
    path.arc(x, y, g.halfWidths[i], 0, Math.PI * 2);
  }
  return path;
}

export function centerlinePath(g: StrokeGeometry, dashLength = 10, dashGap = 8): Path2D {
  const path = new Path2D();
  if (g.centerline.length) path.moveTo(g.centerline[0][0], g.centerline[0][1]);
  for (let i = 1; i < g.centerline.length; i++) path.lineTo(g.centerline[i][0], g.centerline[i][1]);
  void dashLength;
  void dashGap;
  return path;
}
