# Weft — Claude Code Build Brief (v2)

Paste into Claude Code as the project brief (or save as `BUILD.md` and point Claude Code at it). Written as instructions to the coding agent. Build **in milestone order**; stop at each gate and confirm before continuing.

> v2 adds: page-content masking + privacy preview, multi-session merge, automation-brief + ticket export, and an ROI tracker. Read `weft-prd.md` (v2.0) and `weft-concept.md` (v0.2) for full context.

> **Status: all 8 milestones built and gate-verified, plus a post-MVP hardening pass (§ "Post-MVP hardening" below).** This document is kept as the historical build plan — the milestone descriptions below are what was *asked for*; see `ARCHITECTURE.md` for what actually exists now, where the two differ.

---

## Project

Build **Weft**, a Chrome (MV3) extension that records people doing real work, **merges multiple recordings** into the true multi-path workflow, classifies each step, suggests where AI/automation belongs, **generates an implementable brief per opportunity, exports it as a ticket, and tracks realized savings**. Everything runs **locally** — no backend, no accounts, no network calls. Data in `chrome.storage.local`.

## Hard rules (do not violate)

1. **No backend, no network requests, no external APIs.** Fully local.
2. **Never capture: input values, query strings, page-content text from data regions, or screenshots.** Capture element identity (role/label/tag), timestamps, URL path, domain only. Any retained text is PII-redacted. Enforce at capture time.
3. **Worker-initiated only** — capture starts from a user action in the panel, never automatically.
4. **No individual performance metrics** — timing is for process bottlenecks only; never compute per-person speed/productivity.
5. **No autonomous login / credentials.**
6. Build in milestone order; verify each gate before proceeding.

## Stack (use exactly this)

- Build: Vite + `@crxjs/vite-plugin` (MV3 + HMR)
- Language: TypeScript
- UI: React (side panel)
- Graph: React Flow (`reactflow`) with custom nodes + edge labels
- Storage: `chrome.storage.local`
- Styling: plain CSS with the tokens below

## File structure

As originally planned (still an accurate map of intent). See `ARCHITECTURE.md` §2 for the full as-built file list, including what the plan didn't anticipate (`reconstruct/roi.ts`, `lib/map-layout.ts`, `lib/privacy-preview.ts`, `icons/`, `.github/workflows/ci.yml`, and the extra manifest fields for icons/action).

```
weft/
  manifest.config.ts
  vite.config.ts
  tsconfig.json
  src/
    types.ts                 # Workflow, Session, CapturedEvent, MergedNode, Edge, Opportunity, ROI
    taxonomy.ts              # signature → intervention/effort/impact/template/automatable-fraction
    content/
      capture.ts             # listeners + masking + PII redaction
      redact.ts              # PII pattern redaction helpers
    background/
      service-worker.ts      # session lifecycle, storage
    reconstruct/
      segment.ts             # events → steps (pure)
      classify.ts            # step → signature (pure)
      merge.ts               # sessions → merged graph (pure)
      savings.ts             # estimated saving per step (pure)
    brief/
      generate-brief.ts      # opportunity → automation brief (pure)
      export-ticket.ts       # brief → JSON + Jira/Linear Markdown
    sidepanel/
      index.html
      main.tsx
      App.tsx
      components/
        CaptureControls.tsx
        PrivacyPreview.tsx    # pre-save: what will be stored; redact/discard
        WorkflowMap.tsx       # React Flow merged graph
        StepNode.tsx          # custom node (states + branch frequency)
        AnalysisPanel.tsx     # signature, intervention, effort/impact, est. saving, suggestion, thumbs
        Register.tsx
        BriefView.tsx         # brief + export buttons
        RoiPanel.tsx          # shipped / hours / money / estimate-vs-actual
        ConsentScreen.tsx
      styles/{tokens.css,app.css}
    lib/
      storage.ts
      metrics.ts             # local counters (activation, accept-rate, loop-closure)
```

## Data model (`src/types.ts`)

```ts
export type StepSignature =
  | "entry" | "repetitive" | "copy_between_systems" | "judgment_text"
  | "lookup_verification" | "wait_handoff" | "approval_decision" | "exception_branch";

export interface CapturedEvent {
  id: string; ts: number;
  type: "click" | "input" | "submit" | "navigation";
  domain: string; urlPath: string;                 // query stripped
  element: { role: string; label: string; tag: string }; // never value; label PII-redacted
  crossDomainFrom?: string;
}

export interface Session { id: string; workflowId: string; startedAt: number; endedAt?: number; events: CapturedEvent[]; }

export interface MergedNode {
  id: string; order: number; label: string; system: string;
  signature: StepSignature; isCrossSystem: boolean;
  occurrence: number; totalSessions: number; isMainPath: boolean;
  avgDurationMs: number;
  intervention: string; effort: 1|2|3; impact: 1|2|3;
  isOpportunity: boolean; isBottleneck: boolean; isException: boolean;
  suggestionText: string; estimatedSavingHrsPerMonth: number;
}

export interface Edge { id: string; from: string; to: string; occurrence: number; totalSessions: number; }

export interface AutomationBrief {
  problem: string; trigger: string; inputs: string; outputs: string;
  systems: string[]; approach: string; effortEstimate: string; estimatedSavingHrs: number;
}

export interface Opportunity {
  stepId: string; label: string; intervention: string; impact: 1|2|3;
  brief: AutomationBrief; status: "identified" | "specced" | "shipped";
  estimatedSavingHrs: number; realizedSavingHrs?: number;
}

export interface ROI { shippedCount: number; hoursSaved: number; moneySaved: number; estimateVsActualPct: number; }

export interface Workflow {
  id: string; name: string; sessions: Session[];
  mergedNodes: MergedNode[]; edges: Edge[]; register: Opportunity[]; roi: ROI;
}
```

## Taxonomy (`src/taxonomy.ts`)

Signature → intervention, default effort/impact, opportunity/bottleneck flags, suggestion template, and an `automatableFraction` (0–1) used for savings math:

| signature | intervention | effort | impact | opp? | bottle? | autoFrac |
|---|---|---|---|---|---|---|
| entry | keep manual | 1 | 1 | no | no | 0 |
| repetitive | RPA / scripted automation | 2 | 2 | yes | no | 0.9 |
| copy_between_systems | Integration / API bridge | 2 | 3 | yes | no | 0.95 |
| lookup_verification | Automated validation | 2 | 3 | yes | no | 0.8 |
| judgment_text | LLM assist | 3 | 3 | yes | no | 0.5 |
| wait_handoff | Process redesign (not tech) | 1 | 3 | no | yes | 0 |
| approval_decision | Policy automation + routing | 3 | 2 | yes | no | 0.6 |
| exception_branch | Exception handling / triage | 3 | 3 | yes | no | 0.6 |

Suggestions are deterministic template strings (see the mockup for tone). No LLM calls.

## Savings (`reconstruct/savings.ts`)

`estimatedSavingHrsPerMonth = monthlyFrequency × (avgDurationMs / 3.6e6) × automatableFraction`. `monthlyFrequency` from occurrence (assume a configurable runs-per-month; default surfaced in UI). Keep it a pure function; expose the assumptions so the ROI story stays honest.

## Merge (`reconstruct/merge.ts`)

**As built, this evolved past the original "key = system|normalizedLabel|roughOrder" plan** — a literal position-based key breaks the moment one session inserts or skips a step, since every later step in that session shifts to a different index and stops matching sessions that didn't take the detour. The shipped version instead progressively aligns each session's steps into a shared reference timeline using an LCS-style match (by step identity, not position), pairing genuine divergences — single-step swaps, equal-length multi-step swaps, and ragged/unequal-length swaps — as sibling branches at the right position rather than bolting them onto the end. See `ARCHITECTURE.md` §7.3 for the full algorithm and its one remaining residual limitation. Steps present in a minority of sessions (with a real sibling to diverge from) → `isException = true`, `signature = exception_branch`. Alignment decisions are exposed (`MergeAlignment`) so the UI can offer a "merge review"; `MergedList.tsx` surfaces this read-only today. Pure function; unit-tested against hand-merged fixtures (`merge.test.ts`, `merge-alignment.test.ts`).

## Design tokens (`tokens.css`)

```
--canvas:#0C131B; --surface:#141F2A; --surface-2:#1A2732;
--hair:#293947; --ink:#E9F1F6; --muted:#7C91A2;
--signal:#FF5C8A;  --flow:#48CFC2;  --warn:#F2A73B;  --ok:#5FD08A;
Fonts: 'Space Grotesk' (display), 'Inter' (body), 'IBM Plex Mono' (labels/data)
```
Reuse the mockup's node card, analysis panel, and register visuals. Exception nodes get a distinct 4th state.

## Build milestones (stop at each gate)

**M0 — Scaffold.** ✅ done. Vite+crxjs+React+TS; MV3 manifest (side panel, content script, service worker, `storage`); panel renders; content script logs on a test page.
*Gate:* loads unpacked; panel opens; content script injects.

**M1 — Capture + masking + PII redaction.** ✅ done. Content script captures masked events; `redact.ts` strips PII from any retained text; service worker manages start/stop; events persist.
*Gate:* a recorded session stores events with **no values, no query strings, no page-content text**; PII redaction verified on a seeded test page.

**M2 — Reconstruction spike (the hard part).** ✅ done. `segment.ts` + `classify.ts` as pure, unit-tested functions vs. a fixture stream; render steps as a plain list first.
*Gate:* step list matches a hand-made ground-truth map, ordering correct, minor errors only. **Fail → stop.**

**M3 — Privacy preview.** ✅ done. `PrivacyPreview` shown before save: lists step labels/systems/timings, confirms nothing sensitive stored, lets user redact a label or discard the session.
*Gate:* user can review and redact/discard before anything persists.

**M4 — Multi-session merge.** ✅ done. Name a workflow; record ≥2 sessions; `merge.ts` produces main-path-plus-branches with frequency; exceptions flagged; merge-review to fix bad alignments.
*Gate:* merging 3 captures matches a hand-merged fixture and surfaces a variant a single session missed.

**M5 — Map + analysis + register.** ✅ done. React Flow merged graph (custom nodes with 4 states, edge frequency labels); `AnalysisPanel` (signature, intervention, effort/impact, estimated saving, suggestion, thumbs, add/dismiss); `Register` with estimated savings.
*Gate:* click node → analysis; add opportunities → register updates with savings.

**M6 — Brief + ticket export.** ✅ done. `generate-brief.ts` builds an `AutomationBrief` per register item; `BriefView` shows it; `export-ticket.ts` outputs JSON + Jira/Linear Markdown (title, description, checklist).
*Gate:* an accepted opportunity → readable brief → valid JSON + paste-ready Markdown ticket.

**M7 — ROI tracker.** ✅ done. Opportunity status identified→specced→shipped; on shipped, capture realized saving; `RoiPanel` aggregates shipped/hours/money/estimate-vs-actual.
*Gate:* mark an item shipped with a realized saving → ROI view updates and shows estimate-vs-actual.

**M8 — Consent + metrics + polish.** ✅ done. First-run `ConsentScreen` (blocks capture until acknowledged; states principles + masking); local metric counters (activation, accept-rate, loop-closure, **and thumbs-up rate — added during hardening, see below**); empty states in-voice.
*Gate:* full loop works on an unrehearsed workflow: consent → capture → merge → map → brief → ticket → shipped → ROI. Verified on a completely fresh browser profile.

## Post-MVP hardening

Not part of the original milestone plan — found and fixed after all 8 milestones shipped, each verified live in Chromium by reproducing the bug against the pre-fix code first, then confirming the fix closes it. Full detail in `ARCHITECTURE.md`.

1. **Data-grid capture leak (privacy).** `capture.ts`'s `INTERACTIVE_SELECTOR` used a bare `"[role]"`, matching structural/data ARIA roles (`row`, `gridcell`, …) as if they were controls — a click inside a data-grid cell captured that cell's actual content. Fixed by scoping to an explicit widget-role allowlist, and by changing the click handler's `?? el` fallback to `?? null` (the fallback alone had been silently undoing the scoping).
2. **PII redaction gaps.** The digit-run pattern required 9+ digits and only a single space/hyphen separator — missed shorter account/ticket/OTP numbers and currency-formatted amounts (`$45,231.00`). Broadened to 6+ digits with a repeatable separator class (space/comma/period/hyphen/slash/parens).
3. **Cross-tab bleed.** Recording wasn't scoped to a tab — any open tab's clicks fed the active session. Fixed with `chrome.tabs`-based scoping (§ ARCHITECTURE.md 7.5).
4. **Service worker message-queue resilience.** One unhandled rejection in any message handler (e.g. a storage-quota-exceeded write) permanently broke all future message handling until Chrome restarted the worker. Fixed by always recovering the queue through a `.catch()`.
5. **Merge alignment generalized twice more.** First to equal-length multi-step branch swaps, then to unequal-length ("ragged") branch swaps — see the updated Merge section above and `ARCHITECTURE.md` §7.3.
6. **Missing "discovery quality" metric.** Thumbs feedback was captured (M5) but never aggregated into the PRD's thumbs-up-rate metric. Added to `lib/metrics.ts`.
7. **Ops/polish:** extension icons + a toolbar `action` wired to `chrome.sidePanel.setPanelBehavior`, and a GitHub Actions CI workflow (`npm ci && npm test && npm run build` on push/PR).

## Non-goals for this build

No LLM calls, no backend, no accounts, no live Jira/Linear API, no cross-browser, no screenshots, no auto-implementation, no individual performance metrics. If any seem tempting, they're v2 — note and move on.

## First thing to do

~~Start with **M0 only**.~~ All milestones are built. For anyone picking this up next: read `ARCHITECTURE.md` first, then `weft-prd.md` §13 (open decisions) and §10 Phase 7 (design-partner beta + hardening — the actual next phase).
