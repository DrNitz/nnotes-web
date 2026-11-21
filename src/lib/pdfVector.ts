/** Vector-preserving PDF export: ink, shapes and text are native PDF paths/text. */
import { jsPDF, GState } from 'jspdf';
import type { CanvasItem, NNoteDocument, ShapeItem, StrokeItem } from '../types/model';
import { buildStrokeGeometry } from './ink';
import { assetUrl } from '../store/editor';
import type { ThemeMode } from '../store/editor';

const rgb = (c: [number, number, number, number]): [number, number, number] => [c[0], c[1], c[2]];

function alphaFor(c: [number, number, number, number]) {
  return c[3] / 255;
}

function strokeOutline(pdf: jsPDF, item: StrokeItem, sx: number, sy: number) {
  const g = buildStrokeGeometry(item.samples, item.config, {
    finished: true,
    holdEnds: item.tool === 'pen' || item.tool === 'highlighter',
    speedScale: item.speed_scale,
  });
  const [r, gg, b] = rgb(item.config.rgba);
  pdf.setFillColor(r, gg, b);
  pdf.setDrawColor(r, gg, b);
  if (item.tool === 'dashed') pdf.setLineDashPattern([item.config.dash_length * sx, item.config.dash_gap * sx], 0);
  else pdf.setLineDashPattern([], 0);

  if (item.tool === 'dashed') {
    if (g.centerline.length > 1) {
      pdf.moveTo(g.centerline[0][0] * sx, g.centerline[0][1] * sy);
      for (let i = 1; i < g.centerline.length; i++) pdf.lineTo(g.centerline[i][0] * sx, g.centerline[i][1] * sy);
      pdf.setLineWidth(Math.max(0.2, item.config.base_width * sx));
      pdf.stroke();
    }
    return;
  }

  if (g.outline.length >= 3) {
    pdf.moveTo(g.outline[0][0] * sx, g.outline[0][1] * sy);
    for (let i = 1; i < g.outline.length; i++) pdf.lineTo(g.outline[i][0] * sx, g.outline[i][1] * sy);
    pdf.close();
    pdf.fill();
  }
  // Swept discs keep round caps and joins at any zoom level.
  g.centerline.forEach(([x, y], i) => {
    const radius = Math.max(0.1, g.halfWidths[i] * sx);
    pdf.circle(x * sx, y * sy, radius, 'F');
  });
  pdf.setLineDashPattern([], 0);
}

function shapeOutline(pdf: jsPDF, item: ShapeItem, sx: number, sy: number) {
  const [r, g, b] = rgb(item.stroke_rgba);
  pdf.setDrawColor(r, g, b);
  pdf.setLineWidth(Math.max(0.2, item.stroke_width * sx));
  const x1 = item.start[0] * sx, y1 = item.start[1] * sy;
  const x2 = item.end[0] * sx, y2 = item.end[1] * sy;
  const x = Math.min(x1, x2), y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
  const pts = item.points;

  const polygon = (points: [number, number][]) => {
    if (points.length < 2) return;
    pdf.moveTo(points[0][0] * sx, points[0][1] * sy);
    for (let i = 1; i < points.length; i++) pdf.lineTo(points[i][0] * sx, points[i][1] * sy);
    pdf.close();
    if (item.fill_rgba) {
      const [fr, fg, fb] = rgb(item.fill_rgba);
      pdf.setFillColor(fr, fg, fb);
      pdf.fillStroke();
    } else pdf.stroke();
  };

  switch (item.shape) {
    case 'line': pdf.line(x1, y1, x2, y2); pdf.stroke(); break;
    case 'arrow': case 'double_arrow': {
      pdf.line(x1, y1, x2, y2);
      const a = Math.atan2(y2 - y1, x2 - x1);
      const head = Math.max(4, Math.min(w, h) * 0.22);
      pdf.line(x2, y2, x2 - head * Math.cos(a - 0.5), y2 - head * Math.sin(a - 0.5));
      pdf.line(x2, y2, x2 - head * Math.cos(a + 0.5), y2 - head * Math.sin(a + 0.5));
      pdf.stroke();
      break;
    }
    case 'rectangle': case 'cube': case 'prism': case 'cylinder':
      if (item.fill_rgba) { const [fr, fg, fb] = rgb(item.fill_rgba); pdf.setFillColor(fr, fg, fb); pdf.rect(x, y, w, h, 'FD'); }
      else pdf.rect(x, y, w, h, 'S');
      break;
    case 'ellipse': case 'circle': case 'sphere': case 'cone': case 'pyramid':
      if (item.fill_rgba) { const [fr, fg, fb] = rgb(item.fill_rgba); pdf.setFillColor(fr, fg, fb); pdf.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 'FD'); }
      else pdf.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 'S');
      break;
    case 'polygon': case 'polyline': case 'curve': case 'triangle': case 'diamond':
    case 'pentagon': case 'hexagon': case 'star': case 'parallelogram': case 'trapezoid':
    case 'block_arrow_right': case 'block_arrow_left': case 'block_arrow_up': case 'block_arrow_down':
    case 'compass': case 'heart': case 'cloud': case 'callout':
      if (pts && pts.length > 1) polygon(pts);
      else pdf.rect(x, y, w, h, 'S');
      break;
    default: pdf.rect(x, y, w, h, 'S');
  }
}

function drawItem(pdf: jsPDF, item: CanvasItem, sx: number, sy: number) {
  switch (item.kind) {
    case 'stroke': strokeOutline(pdf, item, sx, sy); break;
    case 'shape': shapeOutline(pdf, item, sx, sy); break;
    case 'text': {
      const [r, g, b] = rgb(item.rgba);
      pdf.setTextColor(r, g, b);
      pdf.setFontSize(Math.max(4, item.point_size * sx * 0.75));
      pdf.text(item.text.split('\n'), item.pos[0] * sx, item.pos[1] * sy + item.point_size * sx * 0.75, { maxWidth: item.width * sx });
      break;
    }
    case 'image': {
      const url = assetUrl(item.asset);
      if (url) pdf.addImage(url, 'PNG', item.rect[0] * sx, item.rect[1] * sy, item.rect[2] * sx, item.rect[3] * sy);
      break;
    }
    case 'table': {
      const [x, y, w, h] = item.rect;
      const [r, g, b] = rgb(item.stroke_rgba);
      pdf.setDrawColor(r, g, b);
      pdf.setLineWidth(Math.max(0.2, item.stroke_width * sx));
      const xs = [x];
      item.col_fracs.forEach((f) => xs.push(xs[xs.length - 1] + f * w));
      const ys = [y];
      item.row_fracs.forEach((f) => ys.push(ys[ys.length - 1] + f * h));
      for (let i = 0; i <= item.cols; i++) pdf.line(xs[i] * sx, y * sy, xs[i] * sx, (y + h) * sy);
      for (let i = 0; i <= item.rows; i++) pdf.line(x * sx, ys[i] * sy, (x + w) * sx, ys[i] * sy);
      pdf.stroke();
      break;
    }
    case 'sticky_note': {
      const [x, y, w, h] = item.rect;
      const [r, g, b] = rgb(item.color);
      pdf.setFillColor(r, g, b);
      pdf.setDrawColor(180, 180, 180);
      pdf.rect(x * sx, y * sy, w * sx, h * sy, 'FD');
      break;
    }
    case 'tape': {
      const [x, y, w, h] = item.rect;
      const [r, g, b] = rgb(item.color);
      pdf.setFillColor(r, g, b);
      pdf.setGState(new GState({ opacity: alphaFor(item.color) }));
      pdf.rect(x * sx, y * sy, w * sx, h * sy, 'F');
      pdf.setGState(new GState({ opacity: 1 }));
      break;
    }
    case 'group': item.items.forEach((child) => drawItem(pdf, child, sx, sy)); break;
    default: break;
  }
}

export async function exportPdfVector(doc: NNoteDocument, name: string, theme: ThemeMode = 'light'): Promise<Blob> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
  pdf.setProperties({ title: name });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < doc.pages.length; i++) {
    const page = doc.pages[i];
    if (i > 0) pdf.addPage();
    const sx = pw / page.width;
    const sy = ph / page.height;
    const style = page.style ?? doc.style;
    if (style.page_color) {
      const [r, g, b] = style.page_color;
      pdf.setFillColor(r, g, b);
      pdf.rect(0, 0, pw, ph, 'F');
    }
    if (page.pdf_asset) {
      const url = assetUrl(page.pdf_asset);
      if (url) pdf.addImage(url, 'PNG', 0, 0, pw, Math.min(ph, (page.height / page.width) * pw));
    }
    // Opaque items first, highlighters last with reduced opacity.
    const ink = page.items.filter((it) => it.kind !== 'stroke' || it.tool !== 'highlighter');
    const highlights = page.items.filter((it) => it.kind === 'stroke' && it.tool === 'highlighter');
    ink.forEach((it) => drawItem(pdf, it, sx, sy));
    highlights.forEach((it) => {
      pdf.setGState(new GState({ opacity: it.kind === 'stroke' ? it.config.highlighter_alpha : 0.5 }));
      drawItem(pdf, it, sx, sy);
      pdf.setGState(new GState({ opacity: 1 }));
    });
  }
  void theme;
  return pdf.output('blob');
}
