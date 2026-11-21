/**
 * Per-page raster cache. Keyed by the immutable `pages` array identity (a new array
 * is produced by every commit/undo/redo) plus zoom bucket and theme. Live overlays
 * (selection, in-progress stroke, ruler, eraser cursor) are never cached.
 */
const MAX_PER_DOCUMENT = 6;

export class CanvasCache {
  private store = new WeakMap<object, Map<string, HTMLCanvasElement>>();

  get(pages: object, key: string, build: () => HTMLCanvasElement): HTMLCanvasElement {
    let bucket = this.store.get(pages);
    if (!bucket) { bucket = new Map(); this.store.set(pages, bucket); }
    let canvas = bucket.get(key);
    if (!canvas) {
      canvas = build();
      bucket.set(key, canvas);
      if (bucket.size > MAX_PER_DOCUMENT) {
        const oldest = bucket.keys().next().value;
        if (oldest !== undefined) bucket.delete(oldest);
      }
    }
    return canvas;
  }

  clear() { this.store = new WeakMap(); }
}

export const pageCache = new CanvasCache();
