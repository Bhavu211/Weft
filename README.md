# Weft

Observer-based workflow discovery → merged map → AI/automation suggestions → automation brief → ticket export → measured ROI. A Chrome MV3 extension. Everything runs locally — no backend, no accounts, no network calls.

Full context:
- [`weft-concept.md`](weft-concept.md) — the why
- [`weft-prd.md`](weft-prd.md) — the product spec (v2.0)
- [`BUILD.md`](BUILD.md) — the milestone-by-milestone build plan
- [`CLAUDE.md`](CLAUDE.md) — hard rules for anyone (human or agent) writing code here
- [`reference/weft-mockup.html`](reference/weft-mockup.html) — UI reference for the map/analysis-panel/register visuals

## Status

| Milestone | State |
|---|---|
| M0 — Scaffold | ✅ done |
| M1 — Capture + masking + PII redaction | ✅ done |
| M2 — Reconstruction spike (segment + classify) | ✅ done |
| M3 — Privacy preview | ✅ done |
| M4 — Multi-session merge | ⬜ not started |
| M5 — Map + analysis + register | ⬜ not started |
| M6 — Brief + ticket export | ⬜ not started |
| M7 — ROI tracker | ⬜ not started |
| M8 — Consent + metrics + polish | ⬜ not started |

See `BUILD.md` for each milestone's gate.

## Develop

```bash
npm install
npm run dev      # vite dev server (HMR)
npm run build    # tsc -b && vite build -> dist/, load unpacked in Chrome
npm test         # vitest
```