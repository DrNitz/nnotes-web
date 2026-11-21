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

### Still to build (Phase 3+)

- Shape tool placement UI and hold-to-snap recognition (`ShapeRecognizer.kt`)
- Text boxes, sticky notes, tables, tape, mind maps, images, screenshots as interactive tools
- PDF import / annotation / split view / vector export
- Ruler, scribble-to-erase, disappearing ink, audio clips, handwriting beautify
- Flow text editor, bookmarks, minimap, document switcher search
- Focus timer, streaks, mascots, localization, presentation mode

## Notes on web deviations

- Native stylus pressure/tilt and S-Pen shortcut buttons map to Pointer Events;
  `pressure` is used when available, otherwise a fixed desktop value.
- Palm rejection heuristic (finger within 600 ms of stylus activity) is not yet ported.
- ML Kit handwriting beautification, Whisper transcription and Tree-sitter code
  highlighting require either a web service or a graceful fallback.
- The app's raster caches are replaced by redraw-on-demand; a cache layer should be
  added if large documents show frame drops.
