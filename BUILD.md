# Weft — Claude Code Build Brief (v2)

Paste into Claude Code as the project brief (or save as `BUILD.md` and point Claude Code at it). Written as instructions to the coding agent. Build **in milestone order**; stop at each gate and confirm before continuing.

> v2 adds: page-content masking + privacy preview, multi-session merge, automation-brief + ticket export, and an ROI tracker. Read `weft-prd.md` (v2.0) and `weft-concept.md` (v0.2) for full context.

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

Given multiple `Session[]` for one workflow: segment+classify each, normalize each step to a key `system|normalizedLabel|roughOrder`, collapse matching keys into one `MergedNode` (sum occurrence, average duration), and make divergent keys into branches. Emit `Edge`s with `occurrence/totalSessions`. Steps present in a minority of sessions → `isException = true`, `signature = exception_branch`. Provide the alignment decisions so the UI can offer a "merge review" to fix bad matches. Pure function; unit-test against a hand-merged fixture.

## Design tokens (`tokens.css`)

```
--canvas:#0C131B; --surface:#141F2A; --surface-2:#1A2732;
--hair:#293947; --ink:#E9F1F6; --muted:#7C91A2;
--signal:#FF5C8A;  --flow:#48CFC2;  --warn:#F2A73B;  --ok:#5FD08A;
Fonts: 'Space Grotesk' (display), 'Inter' (body), 'IBM Plex Mono' (labels/data)
```
Reuse the mockup's node card, analysis panel, and register visuals. Exception nodes get a distinct 4th state.

## Build milestones (stop at each gate)

**M0 — Scaffold.** Vite+crxjs+React+TS; MV3 manifest (side panel, content script, service worker, `storage`); panel renders; content script logs on a test page.
*Gate:* loads unpacked; panel opens; content script injects.

**M1 — Capture + masking + PII redaction.** Content script captures masked events; `redact.ts` strips PII from any retained text; service worker manages start/stop; events persist.
*Gate:* a recorded session stores events with **no values, no query strings, no page-content text**; PII redaction verified on a seeded test page.

**M2 — Reconstruction spike (the hard part).** `segment.ts` + `classify.ts` as pure, unit-tested functions vs. a fixture stream; render steps as a plain list first.
*Gate:* step list matches a hand-made ground-truth map, ordering correct, minor errors only. **Fail → stop.**

**M3 — Privacy preview.** `PrivacyPreview` shown before save: lists step labels/systems/timings, confirms nothing sensitive stored, lets user redact a label or discard the session.
*Gate:* user can review and redact/discard before anything persists.

**M4 — Multi-session merge.** Name a workflow; record ≥2 sessions; `merge.ts` produces main-path-plus-branches with frequency; exceptions flagged; merge-review to fix bad alignments.
*Gate:* merging 3 captures matches a hand-merged fixture and surfaces a variant a single session missed.

**M5 — Map + analysis + register.** React Flow merged graph (custom nodes with 4 states, edge frequency labels); `AnalysisPanel` (signature, intervention, effort/impact, estimated saving, suggestion, thumbs, add/dismiss); `Register` with estimated savings.
*Gate:* click node → analysis; add opportunities → register updates with savings.

**M6 — Brief + ticket export.** `generate-brief.ts` builds an `AutomationBrief` per register item; `BriefView` shows it; `export-ticket.ts` outputs JSON + Jira/Linear Markdown (title, description, checklist).
*Gate:* an accepted opportunity → readable brief → valid JSON + paste-ready Markdown ticket.

**M7 — ROI tracker.** Opportunity status identified→specced→shipped; on shipped, capture realized saving; `RoiPanel` aggregates shipped/hours/money/estimate-vs-actual.
*Gate:* mark an item shipped with a realized saving → ROI view updates and shows estimate-vs-actual.

**M8 — Consent + metrics + polish.** First-run `ConsentScreen` (blocks capture until acknowledged; states principles + masking); local metric counters (activation, accept-rate, loop-closure); empty states in-voice.
*Gate:* full loop works on an unrehearsed workflow: consent → capture → merge → map → brief → ticket → shipped → ROI.

## Non-goals for this build

No LLM calls, no backend, no accounts, no live Jira/Linear API, no cross-browser, no screenshots, no auto-implementation, no individual performance metrics. If any seem tempting, they're v2 — note and move on.

## First thing to do

Start with **M0 only**. Scaffold, get it loading unpacked in Chrome, confirm side panel + content script work, and report back before starting M1.
