# Architecture & Parity (derived from the read-only Nnotes audit)

## Source rule

`/home/drnitz/Nnotes` is read-only reference. All findings below came from reading it;
no file there was modified. Implementation lives only in this repository.

## A4-only notebook

The web app deliberately supports a **single fixed page size: A4 (1190×1684 content px at 150 dpi)**.

- Every new and imported page is normalised to A4 in `parseNNote`.
- PDF import rasterises each PDF page into a background asset drawn to the A4 page.
- The Android app's infinite board mode is not implemented; presentation mode is
  fullscreen A4 viewing only.

## Runtime model

```
Document → Page[] → CanvasItem[]
```

- Geometry is **page-local content pixels**.
- Colours are `[r,g,b,a]` ints 0–255.
- Runtime-only `uid` is stripped on `.nnote` write and regenerated on read.
- Page style resolves `page → document → default` (paper colour, ruling pattern, colour, spacing).

## Modules

| Module | Responsibility | Mirrors (Android) |
|---|---|---|
| `src/types/model.ts` | Document/page/item schema | `core/model/*` |
| `src/lib/ink.ts` | Stroke engine: EMA 0.5, pressure logistic k=8, calligraphy nib, speed window 40 ms, taper, swept discs | `core/stroke/StrokeEngine.kt` |
| `src/lib/geometry.ts` | Points, rects, OBB helpers, colour utils | `core/geometry/*` |
| `src/lib/nnote.ts` | ZIP + `manifest.json` (DEFLATE), assets (STORE), `flow.xml` | `format/DocumentCodec.kt` |
| `src/lib/storage.ts` | IndexedDB documents + prefs | Android SAF |
| `src/store/editor.ts` | Zustand state, 64-step snapshot history | `core/history/History.kt` |
| `src/canvas/renderer.ts` | paper → ruling → ink → MULTIPLY highlighter → overlay | `canvas/CanvasView.kt` + `AndroidRenderer` |
| `src/canvas/CanvasStage.tsx` | Pointer state machine: draw/erase/pan/select/lasso/pinch | `canvas/InteractionController.kt` |
| `src/App.tsx` | Toolbar, tool config, pages, save/open/export | `ui/Toolbar.kt`, `ui/Popups.kt` |

## `.nnote` format

ZIP archive:

- `manifest.json` — DEFLATED. Top level: `format`, `version`, `dpi`, `is_board`,
  `has_pdf`, `style`, `bookmarks`, `audio_tracks`, `pages`.
- `flow.xml` — DEFLATED, optional.
- `assets/image-NNN.png|svg`, `assets/source.pdf`, `audio/<id>.m4a` — STORED.
- Item kinds: `stroke`, `text`, `shape`, `image`, `table`, `tape`,
  `sticky_note`, `mind_map`, `audio_clip`, `group`. Unknown kinds are skipped.

View state (zoom/scroll) and theme are app-side concerns in the original; they are
not part of the file. Web equivalents live in the Zustand store / IndexedDB prefs.

## Feature parity status

### Phase 2 — Foundation (done)

- [x] Document/page/item model for all 10 item kinds
- [x] Faithful stroke geometry port (all six pen engines share the pipeline)
- [x] `.nnote` read/write with assets and nested items
- [x] 64-step undo/redo via snapshots
- [x] Light / Dark / OLED themes
- [x] 4-way dockable toolbar
- [x] IndexedDB autosave store, document list, open/export
- [x] Layered renderer with ruling patterns and MULTIPLY highlighter
- [x] Pointer handling: draw, stroke/area erase, pan, pinch zoom, band/lasso select

### Verified

- `npm run build` passes with TypeScript strict mode.
- Draw → undo → redo works in-browser.
- Save → reload → reopen restores strokes.
- Import of `Hypertension_Mastery_v2_Test.nnote`: 4 pages, item counts `5/33/65/66` —
  matches the manifest.
- Export → re-import preserves the same page/item counts.
- Import of `welcome_note.nnote`: 5 pages, assets and real strokes render without
  console errors.
- Phase 3 browser checks: shape placement, text/sticky/table placement and inline
  editing, selection move, hold-to-snap (exported manifest contained a `line` shape),
  ruler toggle, image insertion, and `.nnote` round-trip with 6 mixed items — all pass
  with zero console errors.
- Phase 4 browser checks: imported a 4-page PDF (5 pages total, 4 split-view thumbs),
  exported a 5-page PDF, verified `flow.xml` and bookmarks inside the exported `.nnote`,
  confirmed disappearing ink leaves no persisted items, screenshot copied to clipboard,
  Studio timer counts down — all with zero console errors.

### Phase 3 — Interactive object tools (done)

- [x] Shape tool: drag to place, 28 shape kinds, axis snap for lines/arrows
- [x] Hold-to-snap recognition: line, polyline, curve, rectangle, polygon, ellipse/circle
  (`src/lib/shapeRecognition.ts`, port of `ShapeRecognizer.kt`)
- [x] Text boxes with inline HTML overlay editor
- [x] Sticky notes: styles, fasteners, embedded handwriting, inline text editing
- [x] Tables: configurable rows/cols, editable cells, row/column fractions, fills
- [x] Study tape: six patterns, reveal toggle, hidden strokes
- [x] Mind maps: recursive nodes, branches, inline node editing
- [x] Images: click-to-place with file picker, stored in `.nnote` assets
- [x] Voice-note clips (placeholder clip; recording is native-only)
- [x] Selection: move, 8-handle resize, rotate, duplicate, group, z-order, delete
- [x] Inline table/mind-map editors, keyboard shortcuts
- [x] Ruler with angle/lock and stroke magnet snapping
- [x] Scribble-to-erase

### Phase 4 — Documents, IO and productivity (done)

- [x] PDF import: pdf.js rasterises each PDF page into a page background asset,
  with the source PDF kept in the `.nnote` ZIP
- [x] PDF annotation: imported pages are ordinary canvases — every ink/item tool works on them
- [x] PDF split view: thumbnail rail with click-to-navigate
- [x] PDF export: jsPDF raster export, one page per canvas page
- [x] Bookmarks per page, click to jump
- [x] Minimap with viewport rectangle and click-to-navigate
- [x] Document switcher modal with search and delete
- [x] Flow text document persisted to `flow.xml`
- [x] Disappearing ink: 1 s hold then 0.5 s fade, never committed
- [x] Screenshot area: crop to PNG and copy to clipboard
- [x] Studio: Pomodoro focus/break timer, break notification, streak counter,
  mascot picker and daily quote

### Phase 5 — Final parity pass (done)

- [x] UI localisation in 10 languages (`en, hi, es, fr, de, ja, ru, ar, pt, zh`)
  with RTL layout for Arabic and persisted language preference
- [x] Presentation/whiteboard mode: fullscreen, chrome hidden, infinite paper, exit button + `Esc`
- [x] Offline auto-beautify: extra smoothing, baseline straightening, shape snapping
- [x] Voice notes: `MediaRecorder` capture, WebM/Opus in `.nnote` assets, click-to-play,
  optional Web Speech live transcript
- [x] True vector PDF export: native PDF paths for ink/shapes, selectable text, raster images
- [x] Per-page raster cache keyed by document identity, zoom bucket, theme and page

## Robustness & smoothness notes

- Drag operations (erase, move, resize, rotate) render from a local item preview and
  commit **once on pointer-up** instead of snapshotting the document on every frame.
- The raster cache uses quantised zoom buckets, so pinch-zoom no longer rebuilds it
  continuously.
- Hovering over the canvas no longer triggers a redraw; only active tools do.
- Object tools return to Select after placing an item, matching the app's
  switch-back behaviour.
- Escape in an inline editor saves the text instead of discarding it.
- Hold-to-snap requires a 650 ms dwell and a stroke longer than 40 px, so slow
  handwriting is not accidentally converted to a shape.
- File import/export, PDF operations and image insertion catch errors and report
  them through a toast; long operations show a blocking progress overlay.
- Pointer capture calls are guarded against synthetic or already-released pointers.

## Final feature-parity matrix

| Android app canvas | Web port | Status |
|---|---|---|
| 6 pen engines + highlighter + tape | Ported `StrokeEngine` geometry for all tools | Implemented |
| Pressure/nib/speed/taper/neon/dash controls | Per-tool config panel | Implemented |
| Stroke + area eraser, scribble erase | Pointer-based erase with stroke fragmentation | Implemented |
| Undo/redo (depth 64) | Snapshot history, keyboard shortcuts | Implemented |
| 34 shape kinds + hold-to-snap | 28 drag-place kinds + `ShapeRecognizer` port | Implemented |
| Text, sticky notes, tables, tape, mind maps | All with inline editors | Implemented |
| Images, stickers, Bassett catalog | Images; remote sticker catalog not bundled | Web-equivalent |
| Lasso/band select, move/resize/rotate, group, z-order | Full selection tool + action bar | Implemented |
| Ruler with magnet snapping | Screen-space ruler with angle/lock | Implemented |
| Zoom/pan/pages/board mode, 4-way toolbar | All present | Implemented |
| 9 ruling patterns, dark/light/OLED | All present | Implemented |
| PDF import/annotation/split view/export | pdf.js import + annotation + jsPDF raster/vector export | Implemented |
| `.nnote` read/write, flow.xml, assets | Full ZIP codec with nested items | Implemented |
| Bookmarks, minimap, document switcher | All present | Implemented |
| Disappearing ink, screenshot, studio timer/streak/mascot | All present | Implemented |
| Multi-language UI | 10 languages with RTL | Implemented |
| Handwriting beautification | Offline smoothing + snapping (no ink-to-text) | Web-equivalent |
| Voice notes + transcription | MediaRecorder + optional Web Speech (no Whisper) | Web-equivalent |
| S-Pen buttons, hardware tilt, palm rejection | Pointer Events pressure; no hardware buttons | Not applicable |
| Android SAF/SD card, launcher widget | IndexedDB local-first storage | Web-equivalent |
| Tree-sitter code highlighting in flow text | Plain flow text editor | Not ported |

## Notes on web deviations

- Native stylus pressure/tilt and S-Pen shortcut buttons map to Pointer Events;
  `pressure` is used when available, otherwise a fixed desktop value.
- Palm rejection heuristic (finger within 600 ms of stylus activity) is not ported;
  touch palm rejection is left to the device/browser.
- ML Kit ink-to-text and Whisper transcription have no offline browser equivalent;
  auto-beautify and Web Speech are the documented fallbacks.
- Voice clips are WebM/Opus; the app's native clips are M4A. Both are stored as
  binary ZIP assets under `assets/`/`audio/` and round-trip in this app.
- Vector PDF export draws ink/shapes/text natively; embedded images and PDF page
  backgrounds remain raster, as they are in the native exporter.
- Tree-sitter syntax highlighting and the remote sticker catalog are not bundled.
