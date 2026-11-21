import { useEffect, useRef } from 'react';
import { useEditor } from '../store/editor';
import { itemBounds } from './renderer';
import type { Rect } from '../types/model';

const W = 150;
const H = 110;

/** Small page overview with the current viewport rectangle; click to navigate. */
export function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const page = useEditor((s) => s.doc.pages[s.pageIndex]);
  const zoom = useEditor((s) => s.zoom);
  const origin = useEditor((s) => s.origin);
  const selection = useEditor((s) => s.selection);
  const setOrigin = useEditor((s) => s.setOrigin);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !page) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect: Rect = [0, 0, page.width, page.height];
    const scale = Math.min((W - 16) / rect[2], (H - 16) / rect[3]);
    const ox = (W - rect[2] * scale) / 2;
    const oy = (H - rect[3] * scale) / 2;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#e8e8e3';
    ctx.fillRect(ox, oy, rect[2] * scale, rect[3] * scale);
    ctx.strokeStyle = '#7c8494';
    ctx.lineWidth = 1;
    ctx.strokeRect(ox, oy, rect[2] * scale, rect[3] * scale);

    page.items.forEach((it) => {
      const b = itemBounds(it);
      if (!b) return;
      ctx.fillStyle = selection.includes(it.uid) ? '#38bdf8' : it.kind === 'stroke' ? '#334155' : '#6366f1';
      ctx.fillRect(ox + b[0] * scale, oy + b[1] * scale, Math.max(1, b[2] * scale), Math.max(1, b[3] * scale));
    });

    const host = document.querySelector('.canvas-wrap');
    const box = host?.getBoundingClientRect();
    if (box) {
      const vx = -origin.x / zoom, vy = -origin.y / zoom;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(ox + vx * scale, oy + vy * scale, (box.width / zoom) * scale, (box.height / zoom) * scale);
    }
  }, [page, zoom, origin, selection]);

  const navigate = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!page) return;
    const r = e.currentTarget.getBoundingClientRect();
    const scale = Math.min((W - 16) / page.width, (H - 16) / page.height);
    const ox = (W - page.width * scale) / 2;
    const oy = (H - page.height * scale) / 2;
    const px = ((e.clientX - r.left) - ox) / scale;
    const py = ((e.clientY - r.top) - oy) / scale;
    const host = document.querySelector('.canvas-wrap');
    const box = host?.getBoundingClientRect();
    setOrigin({
      x: -(px - (box?.width ?? 800) / zoom / 2) * zoom,
      y: -(py - (box?.height ?? 600) / zoom / 2) * zoom,
    });
  };

  return <canvas ref={ref} width={W} height={H} className="minimap" onClick={navigate} title="Minimap — click to navigate" />;
}
