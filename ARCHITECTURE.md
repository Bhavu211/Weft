# Weft — Architecture

Technical reference for engineers continuing this build. Companion to `weft-prd.md` (what and why), `BUILD.md` (the milestone history), and `CLAUDE.md` (hard rules). This document describes the system **as built**, not as originally planned — where the two differ, this one wins.

---

## 1. System overview

Weft is a Chrome MV3 extension with three runtime surfaces and no backend:

```
┌─────────────────────┐     chrome.runtime        ┌──────────────────────────┐
│  Content script      │ ──────sendMessage───────▶ │  Service worker           │
│  (src/content/)       │ ◀─────────────────────── │  (src/background/)        │
│  runs on every page   │      response             │  ephemeral, event-driven  │
└──────────┬────────────┘                           └────────────┬─────────────┘
           │ observes clicks/inputs/                              │ chrome.storage.local
           │ submits/navigations                                 │ (the only persistence)
           ▼                                                      ▼
      the page being                                    ┌──────────────────────────┐
      worked in                                          │  Side panel (React)      │
                                                          │  (src/sidepanel/)        │
                                                          │  reads storage, sends    │
                                                          │  messages, renders UI    │
                                                          └──────────────────────────┘
```

Nothing here talks to the network. `chrome.storage.local` is the single source of truth; the service worker is a thin, stateless message router over it (MV3 workers are killed and restarted by Chrome at will, so no in-memory state survives between messages except a short-lived promise queue — see §6).

## 2. Runtime components

### Content script (`src/content/capture.ts`)

Injected on `<all_urls>` at `document_idle`. Listens for `click`/`input`/`submit` (capture phase) plus a synthetic `navigation` event on path changes (including SPA `pushState`/`replaceState`, patched defensively — see the `try/catch` around the `history` patch). For each event it builds a `CapturedEvent` (see §4) using only element **identity** — never a value — and sends it to the service worker via `chrome.runtime.sendMessage`.

Two scoping rules that exist specifically to prevent this file from becoming a privacy hole:

- **`INTERACTIVE_SELECTOR`** is an explicit allowlist of true widget ARIA roles (`button`, `link`, `checkbox`, `tab`, `combobox`, …) plus the native interactive tags. It deliberately excludes structural/data roles (`row`, `gridcell`, `grid`, `table`, `list`, …). A bare `"[role]"` selector — the original implementation — would treat a data-grid cell as "the interactive element" for a click landing inside it, and `getLabel()`'s `textContent` fallback would then capture that cell's actual value.
- The click listener's fallback is `el?.closest(INTERACTIVE_SELECTOR) ?? null`, **not** `?? el`. If no genuine interactive ancestor is found, the event carries no label at all rather than falling back to whatever was clicked. (An earlier version used `?? el` and completely undid the selector scoping above.)

`redact.ts` is applied to every retained string at the moment it's read, before it ever leaves `getLabel()` — masking happens at the source, not as a later cleanup pass.

### Service worker (`src/background/service-worker.ts`)

Stateless request handler for `WeftMessage`s (see §6), plus two `chrome.*` API integrations:

- `chrome.tabs.query` / `chrome.tabs.onCreated` — tab-scoping for an active recording (§7.5).
- `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` — lets the toolbar icon open the panel directly.

All actual session/register/metrics state lives in `chrome.storage.local` via `src/lib/storage.ts`; the service worker never holds session data in module-level variables (it would lose it on the next MV3 idle-kill).

### Side panel (`src/sidepanel/`)

A React app (`App.tsx` as the top-level state owner) rendered in the MV3 `sidePanel` surface. Owns the visible workflow: naming a workflow, starting/stopping capture, reviewing/confirming/discarding a session, merging, walking the map, building the register, generating briefs, shipping, and the ROI/metrics summary. Talks to the service worker only through the typed message protocol (§6); reads/writes `chrome.storage.local` directly for everything that doesn't need serialized read-modify-write semantics (register, feedback, hourly cost, consent).

## 3. Data flow

```
capture.ts (per event)
  → CAPTURE_EVENT message → service-worker.ts → storage.ts: appendEvent()
        (tab-scoped: rejected if sender.tab.id isn't part of the active session)

Stop recording
  → STOP_CAPTURE → segment.ts (events → Step[]) → classify.ts (Step[] → ClassifiedStep[])
        → session.steps persisted, session.reviewed = false

Privacy preview (App.tsx + PrivacyPreview.tsx)
  → user redacts/edits labels, or discards
  → CONFIRM_SESSION → applyLabelEdits() → session.reviewed = true
        (only reviewed sessions are eligible for merge)

Merge (App.tsx: handleMerge)
  → getReviewedSessionsForWorkflow(workflowId) → merge.ts
        → segment+classify each session again, fold into one MergeResult
        (MergedNode[] + Edge[] + MergeAlignment[])

Map + analysis (WorkflowMap.tsx, StepNode.tsx, AnalysisPanel.tsx)
  → click a node → taxonomy-derived intervention/effort/impact/suggestion
  → thumbs feedback → storage.ts: setFeedback()
  → "+ Add to register" → Opportunity snapshot → storage.ts: saveRegister()

Brief + ticket (BriefView.tsx)
  → generate-brief.ts (Opportunity → AutomationBrief, deterministic template)
  → export-ticket.ts (→ JSON string, → Jira/Linear Markdown string)
  → clipboard write (navigator.clipboard.writeText)

ROI (RoiPanel.tsx)
  → "Mark shipped" + realized saving → Opportunity.status = "shipped"
  → roi.ts: computeRoi(register, hourlyCost) → shipped count / hours / money / estimate-vs-actual
```

## 4. Data model (`src/types.ts`)

| Type | Produced by | Notes |
|---|---|---|
| `CapturedEvent` | `capture.ts` | Never a value; `element.label` is already redacted by the time it's captured. |
| `Session` | `service-worker.ts` | `reviewed` gates eligibility for merge. `steps` is the segmented+classified derived view, recomputed on stop. |
| `Step` / `ClassifiedStep` | `segment.ts` / `classify.ts` | Pure, one input session → one output list. |
| `MergedNode` | `merge.ts` | One node per distinct step identity at one position in the merged timeline. Carries taxonomy-derived fields (`intervention`, `effort`, `impact`, `suggestionText`, `estimatedSavingHrsPerMonth`) computed at merge time, not stored separately. |
| `Edge` | `merge.ts` | `occurrence`/`totalSessions` — how many of the merged sessions actually took this transition. |
| `MergeAlignment` | `merge.ts` | Which `(sessionId, stepId)` pairs became each `MergedNode` — the basis for a future "merge review" UI; currently surfaced read-only via `MergedList.tsx`. |
| `Opportunity` | `App.tsx: handleAddToRegister` | **A frozen snapshot**, not a live pointer back into a `MergeResult` — deliberately, since re-merging (recording another session) can shift `MergedNode` ids. Everything `generate-brief.ts` needs is captured here at add-time. |
| `AutomationBrief` | `generate-brief.ts` | Deterministic template output, attached to an `Opportunity` once generated. |
| `ROI` | `roi.ts` | Derived, not stored — recomputed from the register + hourly cost on read. |
| `Workflow` | *(unused)* | Declared in the original data model; the implementation never materializes a persisted `Workflow` object — a workflow is just a `workflowId` string that sessions/registers are keyed by. Kept in `types.ts` for now; remove or wire it up if a dedicated per-workflow object becomes necessary. |

## 5. Storage schema (`src/lib/storage.ts`)

Everything lives under these top-level `chrome.storage.local` keys:

| Key | Shape | Written by |
|---|---|---|
| `weft_sessions` | `Record<sessionId, Session>` | capture start/stop, confirm, discard |
| `weft_active_session_id` | `string \| null` | start/stop capture |
| `weft_active_session_tab_ids` | `number[]` | start/stop capture, `chrome.tabs.onCreated` |
| `weft_registers` | `Record<workflowId, Opportunity[]>` | add/remove/generate-brief/ship |
| `weft_feedback` | `Record<mergedNodeId, "up" \| "down">` | thumbs vote |
| `weft_hourly_cost` | `number` | ROI panel's editable assumption |
| `weft_consent_acknowledged` | `boolean` | first-run consent screen |
| `weft_metrics` | `MetricCounters` | activation/accept/ship counters |

No key is ever synced (`chrome.storage.sync` is not used) and nothing is namespaced per-origin — this is intentional; the whole point is a single local record of the person's own work.

**Known gap:** there's no `unlimitedStorage` permission and no proactive quota-usage UI. The service worker's message queue now recovers from a write failure (§6) instead of breaking permanently, but a user who records heavily for a long time could still eventually hit the default ~10MB cap with only a console error to show for it.

## 6. Message protocol (`src/background/messages.ts`)

`WeftMessage` is a discriminated union: `START_CAPTURE`, `STOP_CAPTURE`, `CAPTURE_EVENT`, `GET_CAPTURE_STATE`, `CONFIRM_SESSION`, `DISCARD_SESSION`. Each has a typed response shape (`StartCaptureResponse`, etc.).

**Serialization.** `chrome.runtime.onMessage` fires once per message with no inherent ordering guarantee across concurrent calls. Two `CAPTURE_EVENT`s arriving close together (very common — clicks and inputs fire in quick succession) could both read the same stale session snapshot before either writes, silently losing one. Every message is chained through one shared `messageQueue` promise so each handler's read-modify-write cycle finishes before the next one starts.

**Resilience.** The queue variable is always re-derived through a `.catch()` that logs and swallows the error. Earlier, an unhandled rejection anywhere in `handleMessage` (e.g. a `chrome.storage.local.set` rejecting because of a full quota) would leave `messageQueue` itself rejected — and every later message chains onto it with `.then()`, which silently skips its callback once the promise it's chained from is rejected. That failure mode made **one** bad message permanently stop the service worker from handling **anything** else until Chrome restarted it. Only the one failing message's response is lost now; everything after it is handled normally.

## 7. Reconstruction & merge algorithms

### 7.1 `segment.ts` (pure)

Groups a session's raw `CapturedEvent[]` into `Step[]`. A new step starts on: URL path change, domain change, the previous event being a `submit`, or an idle gap over `IDLE_GAP_MS` (8000ms, not currently configurable in the UI — see PRD §13 open decision 2). A step's label is the last event in its group that has a non-empty `element.label`, falling back to the first event's role.

### 7.2 `classify.ts` (pure)

Assigns a `StepSignature` per step via ordered heuristics: a duration ≥ 5 minutes reads as `wait_handoff` (checked first, overriding everything else); then cross-system steps with input/submit read as `copy_between_systems`; then label keyword matches for approval/exception/lookup words; then a textarea input reads as `judgment_text`; anything else with an input is `entry`. A step recurring 3+ times in one session gets promoted from `entry` to `repetitive`, unless it already has a more specific signature.

### 7.3 `merge.ts` (pure) — the core alignment algorithm

Given every session recorded under one workflow name:

1. `segment` + `classify` each session independently.
2. Progressively fold each session's step sequence into a running **reference timeline** (`foldSessionIntoReference`), one session at a time. The reference is `Slot[]`; each `Slot` holds one or more `Candidate`s (distinct step identities observed at that position — most slots hold exactly one).
3. Alignment within a fold uses an LCS-style dynamic program (`computeAnchors`) where "equality" is "this reference slot already contains a candidate with this key" (`domain::normalizedLabel`, position-independent) rather than literal element equality — so a session's step can match a slot that already holds several alternatives.
4. Between anchor matches, a **gap** — some number of reference-only slots facing some number of session-only steps — is resolved by `appendGap`:
   - `pairedLen = min(refGapLen, stepGapLen)` positions pair up front-to-back as **sibling candidates on the same slot** (a branch: the session took a different step, or a different equal-length sequence of steps, at this position).
   - Whichever side has leftover steps beyond `pairedLen` continues them immediately after the paired positions (still before the next anchor) — a ragged branch (unequal step counts to reach the same reconvergence point) lands its extra step(s) *between* the fork and the rejoin, not appended past the rejoin.
   - When `pairedLen === 0` (one side is empty), this degenerates correctly into a pure insertion or pure deletion.
5. After all sessions are folded, each slot's candidates are sorted by occurrence; the highest becomes `isMainPath`. `isException` requires **both** `!isMainPath` **and** a real sibling to diverge from (`slot.candidates.length > 1`) **and** `occurrence/totalSessions < 0.5` — a lone low-occurrence candidate with no sibling is treated as an optional step, not a branch, since there's nothing for it to be diverging from.
6. Node ids are `node-{slotIndex}-{candidateIndex}`, assigned once the final slot array is known. `Edge`s are built by **replaying each session's own step order** against the final node-id mapping (not the reference order) — this is what makes edges correct even for sessions that skipped steps, detoured, or took a longer/shorter branch.

**Known residual limitation:** the pairing in step 4 is positional (front-to-back within the gap), not itself a search for the best alignment *within* a multi-step gap. If a gap has, say, 3 reference steps facing 3 session steps that aren't actually in the same order relationship, they'll still be paired 1:1 by position rather than re-aligned internally. In practice this only matters for gaps with more than one paired position each containing already-divergent content; the common cases (single-step swap, equal-length swap, ragged/unequal-length swap, pure insertion, pure deletion) are all covered by tests in `merge.test.ts` and `merge-alignment.test.ts`.

### 7.4 `taxonomy.ts` + `savings.ts` + `roi.ts`

`taxonomy.ts` is a static, deterministic `StepSignature → { intervention, effort, impact, isOpportunity, isBottleneck, automatableFraction, suggestionText }` table — no LLM calls anywhere in this pipeline. `savings.ts` computes `estimatedSavingHrsPerMonth = (runsPerMonth × occurrence/totalSessions) × (avgDurationMs / 3.6e6) × automatableFraction` — a step only present in a minority of sessions claims a proportional slice of the assumed monthly volume, not all of it. `roi.ts` aggregates only `status === "shipped"` opportunities: `hoursSaved` sums `realizedSavingHrs`, `moneySaved = hoursSaved × hourlyCost`, `estimateVsActualPct = hoursSaved / sum(estimatedSavingHrs for shipped) × 100`.

### 7.5 Tab-scoping (`service-worker.ts` + `storage.ts`)

The content script runs on every open tab, so without scoping, `captureEvent` would append events from *any* tab into whatever session is active — including a tab the user has open but isn't recording. `startCapture` records `chrome.tabs.query({ active: true, currentWindow: true })`'s tab id as the session's sole allowed contributor; `chrome.tabs.onCreated` extends that set when a new tab's `openerTabId` is already in it (so a workflow step that opens a link in a new tab is still captured); `captureEvent` rejects any event whose `sender.tab.id` isn't in the tracked set. No new manifest permission was needed — `tab.id`/`tab.openerTabId` don't require the `"tabs"` permission.

## 8. Security & privacy model

This is the product's central constraint (see `CLAUDE.md`'s hard rules), enforced at several layers rather than any single one:

1. **Capture-time masking** — `capture.ts` never reads `.value` from any input; only role/label/tag identity.
2. **Interactive-role scoping** — only genuine widget roles produce a label at all (§2); structural/data roles (grid cells, rows, tables) never do.
3. **PII redaction** — `redact.ts` patterns for email, PAN, GST, and a broad digit-run pattern (6+ digits, tolerating space/comma/period/hyphen/slash/parens as separators — catches short account/ticket/OTP numbers and currency-formatted amounts, not just full card numbers) applied at the moment text is read.
4. **Privacy preview** — nothing is "confirmed" (eligible for merge) until the user has seen every step label/system/timing and had the chance to redact or discard.
5. **Tab-scoping** — an active recording only ever sees the tab it started in (§7.5).
6. **Consent gate** — the entire app (not just the Start button) is blocked behind an explicit first-run acknowledgment of what is/isn't captured.
7. **No network** — there is no `fetch`/`XMLHttpRequest`/remote origin anywhere in `src/`; verified by grep as part of the hardening pass, not just by convention.

## 9. Build & tooling

- **Vite + `@crxjs/vite-plugin`** — `vite.config.ts` wires `manifest.config.ts` (a typed `defineManifest` call) into the MV3 build; `npm run dev` gives HMR, `npm run build` (`tsc -b && vite build`) produces `dist/` as a loadable unpacked extension.
- **Manifest** (`manifest.config.ts`) declares only `storage` and `sidePanel` permissions, `<all_urls>` content-script matches, an `action` with `default_icon`/`default_title`, and `icons` at 16/32/48/128px (`icons/icon-*.png`, generated with Pillow — see the icon generation note in the git history if regenerating).
- **CI** (`.github/workflows/ci.yml`) runs `npm ci && npm test && npm run build` on every push to `main` and every PR.

## 10. Testing strategy

Two distinct verification modes, deliberately not mixed:

- **Pure functions** (`segment`, `classify`, `merge`, `taxonomy`, `savings`, `roi`, `generate-brief`, `export-ticket`, `redactText`, `privacy-preview`, `map-layout`, `metrics`) are unit-tested with Vitest, run in Node with no DOM. These are fast, deterministic, and cheap to run in CI.
- **DOM/`chrome.*`-API-touching code** (`capture.ts`, `service-worker.ts`, the full React UI) is **not** unit-tested — there's no jsdom/chrome-mock harness in this repo. It's verified by building the extension and driving it with Playwright against a real Chromium instance (`/opt/pw-browsers/chromium-*` in the dev container), loaded via `--load-extension`. This is how every milestone gate and every hardening fix in this project's history was actually confirmed, including reproducing a bug against the pre-fix code before confirming the fix closes it.

**Gotcha for anyone writing new Playwright checks against this repo:** a real `chrome.sidePanel` is not a tab and never steals active-tab focus when you interact with it. The common workaround for driving it with Playwright — opening its HTML directly at `chrome-extension://<id>/src/sidepanel/index.html` as an ordinary page — does *not* preserve that property. Calling `page.bringToFront()` on that simulated panel page actually changes which tab `chrome.tabs.query({ active: true })` returns, which a real side-panel click never does. Keep the actual workflow tab frontmost throughout a verification script, and interact with the panel's elements without bringing it to front (Playwright can dispatch actions to a non-frontmost page's CDP target directly).

## 11. Known limitations

See `weft-prd.md` §13 for the open decisions needing product/business sign-off (pilot workflow choice, idle-gap threshold, savings-input ownership, MVP palette). Purely technical residuals not covered there:

- Merge alignment's positional pairing within a multi-step gap (§7.3) can mis-pair a gap containing more than one already-divergent position each.
- No storage-quota usage indicator or `unlimitedStorage` permission (§5).
- Single-window assumption in tab-scoping (§7.5) — a workflow spanning multiple browser *windows* isn't handled, only multiple tabs within one window.
- `Workflow` (in `types.ts`) is declared but never materialized as a persisted object — the implementation works entirely off `workflowId` strings as a grouping key across sessions/registers.
