# Weft

Observer-based workflow discovery → merged map → AI/automation suggestions → automation brief → ticket export → measured ROI. A Chrome MV3 extension. Everything runs locally — no backend, no accounts, no network calls.

Full context:
- [`weft-concept.md`](weft-concept.md) — the why
- [`weft-prd.md`](weft-prd.md) — the product spec (v2.0, updated with as-built notes)
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — the system as built: components, data flow, algorithms, security model, testing strategy
- [`BUILD.md`](BUILD.md) — the milestone-by-milestone build plan (all done) + the post-MVP hardening pass
- [`CLAUDE.md`](CLAUDE.md) — hard rules for anyone (human or agent) writing code here
- [`reference/weft-mockup.html`](reference/weft-mockup.html) — UI reference for the map/analysis-panel/register visuals

## Status

| Milestone | State |
|---|---|
| M0 — Scaffold | ✅ done |
| M1 — Capture + masking + PII redaction | ✅ done |
| M2 — Reconstruction spike (segment + classify) | ✅ done |
| M3 — Privacy preview | ✅ done |
| M4 — Multi-session merge | ✅ done |
| M5 — Map + analysis + register | ✅ done |
| M6 — Brief + ticket export | ✅ done |
| M7 — ROI tracker | ✅ done |
| M8 — Consent + metrics + polish | ✅ done |

All 8 MVP milestones are built and gate-verified. See `BUILD.md` for each milestone's gate and `weft-prd.md` §10 (Phase 7) for what comes after — design-partner beta and hardening.

## Develop

```bash
npm install
npm run dev      # vite dev server (HMR)
npm run build    # tsc -b && vite build -> dist/, load unpacked in Chrome
npm test         # vitest
```