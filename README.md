# Nnotes Web

A browser-based port of the **Nnotes Android app canvas** — local-first handwritten notes, PDF markup, and study tools.

> [!IMPORTANT] Strict source-access rule
> The original Android project at `/home/drnitz/Nnotes` is a **read-only reference**.
> It is consulted only to extract information about app-canvas features. **No file in
> that project may ever be created, edited, deleted, or committed as part of this work.**
> All implementation happens exclusively inside this repository.

## Status

- [x] Phase 0 — Feature audit of the Android canvas
- [x] Phase 1 — Repository created and cloned
- [x] Phase 2 — Foundation & architecture
- [x] Phase 3 — Interactive object tools
- [x] Phase 4 — Documents, IO and productivity
- [ ] Phase 5 — Localization, presentation & native-only parity
- [ ] Phase 6 — Verification / feature-parity matrix

## Docs

- [Architecture & parity matrix](docs/ARCHITECTURE.md)

## Run locally

```bash
npm install
npm run dev     # http://localhost:5173
npm run build
```

## Origin

Inspired by and derived from [Nnotes](https://github.com/HarshitaDoddagoudar/Nnotes) by Harshita Doddagoudar and Dr.N (DrNitz), licensed under MIT. This web port is an independent implementation in a separate repository.

## License

MIT — see [LICENSE](LICENSE).
