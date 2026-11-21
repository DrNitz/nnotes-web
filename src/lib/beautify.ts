/**
 * Offline "auto-beautify": extra smoothing, baseline straightening and optional
 * shape snapping for selected ink. The native app uses ML Kit Digital Ink; this is
 * the local, deterministic equivalent — no network, no model download.
 */
import type { CanvasItem, Pt, StrokeItem, StrokeSample } from '../types/model';
import { ema } from './ink';
import { resample, recognizeShape } from './shapeRecognition';
import { makeShape } from './items';

const SNAP_KINDS = new Set(['line', 'rectangle', 'ellipse', 'polygon']);

export function beautifyStroke(stroke: StrokeItem): CanvasItem {
  const pts = stroke.samples.map((s) => [s[0], s[1]] as Pt);
  if (pts.length < 4) return stroke;

  const dense = resample(pts, Math.max(18, pts.length * 2));
  const xs = ema(dense.map((p) => p[0]), 0.35);
  const ys = ema(dense.map((p) => p[1]), 0.35);
  let smoothed: Pt[] = xs.map((x, i) => [x, ys[i]] as Pt);

  const first = smoothed[0];
  const last = smoothed[smoothed.length - 1];
  const dx = Math.abs(last[0] - first[0]);
  const dy = Math.abs(last[1] - first[1]);
  if (dx > 24 && dy / dx < 0.12) {
    const meanY = smoothed.reduce((a, p) => a + p[1], 0) / smoothed.length;
    smoothed = smoothed.map((p) => [p[0], p[1] * 0.2 + meanY * 0.8] as Pt);
  }

  const recognized = recognizeShape(smoothed);
  if (recognized && SNAP_KINDS.has(recognized.kind)) {
    return makeShape(recognized.kind, recognized.start, recognized.end, stroke.config.rgba, null, recognized.vertices);
  }

  const pressure = stroke.samples.map((s) => s[2]);
  const samples: StrokeSample[] = smoothed.map((p, i) => {
    const src = Math.min(pressure.length - 1, Math.round((i / (smoothed.length - 1)) * (pressure.length - 1)));
    return [p[0], p[1], pressure[src] ?? 0.7, i * 8];
  });
  return { ...stroke, samples };
}

export function beautifySelected(items: CanvasItem[], ids: string[]): CanvasItem[] {
  return items.map((it) => (ids.includes(it.uid) && it.kind === 'stroke' ? beautifyStroke(it) : it));
}
