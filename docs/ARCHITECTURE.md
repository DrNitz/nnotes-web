# Architecture & Parity (derived from the read-only Nnotes audit)

## Source rule

`/home/drnitz/Nnotes` is read-only reference. All findings below came from reading it;
no file there was modified. Implementation lives only in this repository.

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

### Still to build (Phase 5+)

- Handwriting beautification (ML Kit equivalent), voice recording/transcription
- Full UI localization (the native app ships 10+ language packs)
- Presentation/whiteboard mode and board minimap
- True vector PDF export (web export is raster via jsPDF)
- Large-document raster cache layer if frame drops appear

## Notes on web deviations

- Native stylus pressure/tilt and S-Pen shortcut buttons map to Pointer Events;
  `pressure` is used when available, otherwise a fixed desktop value.
- Palm rejection heuristic (finger within 600 ms of stylus activity) is not yet ported.
- ML Kit handwriting beautification, Whisper transcription and Tree-sitter code
  highlighting require either a web service or a graceful fallback.
- The app's raster caches are replaced by redraw-on-demand; a cache layer should be
  added if large documents show frame drops.
