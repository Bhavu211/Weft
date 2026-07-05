# CLAUDE.md — Weft

Persistent rules for this repo. Read this every session before writing code. These override any tempting shortcut.

## What this is

Weft is a **Chrome MV3 extension** that records people doing real work, merges multiple recordings into the true multi-path workflow, classifies each step, suggests where AI/automation belongs, generates an implementable brief per opportunity, exports it as a ticket, and tracks realized savings. **Everything runs locally.**

Full context: `weft-concept.md` (why), `weft-prd.md` (spec), `BUILD.md` (the milestone plan). When in doubt, `BUILD.md` and this file win.

## Hard rules (never violate)

1. **No backend. No network requests. No external APIs.** Capture, merge, reconstruction, suggestions, and ROI all run client-side. Data lives only in `chrome.storage.local`.
2. **Never capture: input values, query strings, page-content text from data regions, or screenshots.** Capture element identity (role / accessible label / tag), timestamps, URL path, and domain only. Prefer stable roles/labels over visible text. PII-redact any retained text **at capture time**, not after.
3. **Worker-initiated only.** Capture starts from a user action in the side panel — never automatically, never remotely, never covert.
4. **No individual performance metrics — ever.** Timing is used solely to find process bottlenecks. Never compute or expose per-person speed, productivity, or comparison.
5. **No autonomous login or credential handling.** The user is already logged in; Weft only observes.
6. **Build one milestone at a time.** Do only the milestone asked for, stop at its gate, and report. Do not sprint ahead to a working-looking whole.

## Stack (use exactly this)

- Build: **Vite + @crxjs/vite-plugin** (MV3 + HMR)
- Language: **TypeScript**
- UI: **React** (side panel surface)
- Graph: **React Flow** (`reactflow`) with custom nodes + edge labels
- Storage: **`chrome.storage.local`**
- Styling: plain CSS with the design tokens below

## Design tokens

```
--canvas:#0C131B; --surface:#141F2A; --surface-2:#1A2732; --hair:#293947;
--ink:#E9F1F6; --muted:#7C91A2;
--signal:#FF5C8A;  /* AI opportunity / the weft thread — the one loud colour */
--flow:#48CFC2;    /* normal transition / structure */
--warn:#F2A73B;    /* bottleneck */
--ok:#5FD08A;      /* shipped / realized savings */
Fonts: 'Space Grotesk' (display), 'Inter' (body), 'IBM Plex Mono' (labels/data/metrics)
```
Signal pink marks exactly one thing at a time — never decorative.

## Code conventions

- **Reconstruction and merge are pure, unit-tested functions.** `segment.ts`, `classify.ts`, `merge.ts`, `savings.ts` take data in, return data out, no side effects. Write tests against fixtures. This is the riskiest logic — keep it legible and testable.
- **Masking happens in the content script, at the source.** Never read a value you intend to discard; don't capture it in the first place.
- **Persist to storage, don't rely on service-worker memory.** MV3 workers are ephemeral — state that must survive goes to `chrome.storage.local`.
- **The shared data model lives in `src/types.ts`.** Extend it there; keep it typed end to end.
- **Suggestions are deterministic templates** from `taxonomy.ts`. No LLM calls in this build.
- No secrets, keys, or tokens anywhere — there's no backend to hold them.

## Privacy (first-class, not fine print)

- Store field identity only; never values, query strings, page content, or screenshots.
- Run PII redaction on any retained text (emails, PAN/GST, account/card-like numbers, name fields).
- Show a **pre-save privacy preview** so the user sees exactly what will be stored and can redact or discard.
- Nothing is ever transmitted. The honest claim is "structurally, we don't capture the sensitive part."

## Do NOT build (out of scope — note for v2 and move on)

Backend / accounts / cloud · autonomous login · backend log ingestion · LLM-generated suggestions · auto-implementing any automation · live Jira/Linear write API (MVP exports a file) · multi-workflow parallel capture · non-Chrome browsers · screenshots · **any individual performance analytics**.

## Definition of done (per milestone)

A milestone is done only when its gate in `BUILD.md` passes — verified in Chrome, not assumed. Then commit with a message naming the milestone and that its gate passed. Only then move to the next.
