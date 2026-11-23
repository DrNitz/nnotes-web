import type { Pt, Rgba, Rect } from '../types/model';

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);
export const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
export const scale = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];

export function rectFromPoints(a: Pt, b: Pt): Rect {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])];
}

export function pointInRect(p: Pt, r: Rect): boolean {
  return p[0] >= r[0] && p[0] <= r[0] + r[2] && p[1] >= r[1] && p[1] <= r[1] + r[3];
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return !(a[0] + a[2] < b[0] || b[0] + b[2] < a[0] || a[1] + a[3] < b[1] || b[1] + b[3] < a[1]);
}

export function circleIntersectsRect(center: Pt, radius: number, r: Rect): boolean {
  const x = clamp(center[0], r[0], r[0] + r[2]);
  const y = clamp(center[1], r[1], r[1] + r[3]);
  return (center[0] - x) ** 2 + (center[1] - y) ** 2 <= radius * radius;
}

export function pointInPolygon(p: Pt, polygon: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function centroid(points: Pt[]): Pt {
  if (!points.length) return [0, 0];
  const sum = points.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]] as Pt, [0, 0]);
  return [sum[0] / points.length, sum[1] / points.length];
}

export function rgba(...args: [number, number, number] | [Rgba]): Rgba {
  if (args.length === 1) return args[0];
  return [args[0], args[1], args[2], 255];
}

export function rgbaCss(c: Rgba, alpha = 1): string {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${(c[3] / 255) * alpha})`;
}

export function hexToRgba(hex: string): Rgba {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) return [0, 0, 0, 255];
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16), 255];
}

export function rgbaToHex(c: Rgba): string {
  return '#' + c.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('');
}
