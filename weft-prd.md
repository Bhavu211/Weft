# Weft — MVP Product Requirements Document (v2.0)

*Observer-based workflow discovery → spec → hand-off → measured ROI. Chrome extension MVP.*

Companion to `weft-concept.md` (v0.2, the why) and `weft-mockup.html` (UI reference). This is the build spec.

> v2.0 changelog: adds multi-session merge, page-content masking + privacy preview, automation-brief + ticket export, an ROI tracker, and worker-consent principles. North Star flips from "opportunities exported" to "realized savings."

> **Implementation status: all 8 MVP milestones (`BUILD.md`) are built and gate-verified**, plus a post-MVP hardening pass (privacy fixes, a service-worker resilience fix, merge-alignment improvements, CI/icons). This document remains the authoritative product spec; where an FR below has a note in *italics*, that's what changed or was clarified during the build. See `ARCHITECTURE.md` for full technical detail and `BUILD.md` for the build history.

---

## 1. Summary

Weft is a Chrome (MV3) extension that records people doing real work, merges multiple recordings into the true multi-path workflow, classifies each step, suggests where AI/automation belongs, generates an implementable spec per opportunity, hands it off as a groomable ticket, and tracks the savings actually realized.

**MVP goal:** prove the closed loop works end to end for one workflow type, one browser, fully local, with one design partner — capture → merged map they trust → suggestion they accept → brief a team acts on → a measured saving.

**Success definition:** a design partner captures a workflow (several times), reaches a merged map, accepts ≥1 suggestion, exports a brief that becomes a real ticket, and records a realized saving when it ships.

## 2. Product principles (constraints, not copy)

- **Worker-initiated:** capture starts only from the person doing the work, on their action. Never covert or remotely triggered.
- **Worker-owned:** the person previews exactly what was captured and can redact/delete before sharing. Sharing is opt-in.
- **No individual performance metrics.** Ever. Timing is used for process bottlenecks only, never to rate a person.
- **Privacy by structure:** design so sensitive data can't be captured, rather than protecting it after.

These are enforced in the product, not just documented.

## 3. Scope

**In**
- Chrome MV3 extension, worker-initiated capture
- Structural event capture with **values *and* page content masked**, PII redaction, and a **pre-save privacy preview**
- **Multi-session capture + merge** → main path + variant branches with frequency
- Rules-based reconstruction + step classification (incl. exception branches)
- Templated AI-opportunity suggestions with **estimated savings**
- **Automation-brief generation** + **ticket export** (Jira/Linear-ready Markdown + JSON)
- **ROI tracker** — estimated + realized savings, local
- Interactive map, analysis panel, register, consent + privacy-preview surfaces
- Local storage only

**Out (deliberately — do not build)**
- Backend, accounts, cloud, network calls
- Autonomous login / credential handling
- Backend log ingestion
- LLM-generated suggestions (v2)
- Auto-implementing automations
- Direct write-API push to Jira/Linear (MVP exports; live sync is v2, needs backend)
- Individual performance analytics (never — by principle)
- Non-Chrome browsers, mobile, screenshots

## 4. Users

- **User:** ops/transformation analyst — records workflows, reviews opportunities, exports briefs.
- **Buyer:** Head of Ops/Transformation — needs the savings and the evidence. (Not an MVP UI persona, but the ROI view is built for them.)

## 5. Functional requirements

**FR-1 Capture control.** Side panel Start/Stop, a persistent recording indicator, and a visible "values and on-screen content are not captured" reassurance during recording. Capture is disabled until first-run consent is acknowledged (the consent screen gates the entire app, not just the Start button). *An active recording is also scoped to the tab it started in (plus any tab opened from it) — a tab the user just happens to have open elsewhere never contributes events, even though the content script runs everywhere. This wasn't in the original FR but follows directly from "worker-initiated": only the tab actually being worked in should count.*

**FR-2 Event capture.** Per action: type (click/input/submit/navigation), element descriptor (role, accessible name or stable label, tag — never value), timestamp, URL path (query stripped), domain. Cross-domain transitions flagged. *Element identity is only read from genuine interactive controls (an explicit ARIA widget-role allowlist plus native interactive tags) — never from structural/data roles like table rows or grid cells, which would otherwise expose page-content values through the "label" field. See FR-3.*

**FR-3 Masking (hard rule, extended).** Never store: input values, query strings, screenshots, **or page-content text from data regions**. Prefer roles/ARIA labels/stable selectors for step labels over visible text. Any retained text passes a PII-redaction pass (patterns for emails, PAN/GST, account/card-like numbers, obvious name fields). Enforced at capture time. *The digit-run pattern catches 6+ digit runs (not just 9+), tolerating space/comma/period/hyphen/slash/parens separators — short account/ticket/OTP numbers and currency-formatted amounts are redacted, not just full card numbers. Name-field redaction remains a hard, generically-unsolvable problem for a regex pass; the primary mitigation is FR-2's role scoping, which stops most name leaks (e.g. a customer-name grid cell) at the source rather than relying on redaction to catch them after the fact.*

**FR-4 Privacy preview.** Before a session is saved, show the user a plain-language summary of exactly what will be stored (step labels, systems, timings — and confirmation that no values/content were kept), with the option to redact any label or discard the session.

**FR-5 Multi-session capture.** The user names a workflow and can record it multiple times (same or different runs) under that name.

**FR-6 Merge.** Align sessions of the same named workflow into one graph: shared steps collapse into a main path; divergences become labeled variant branches carrying an occurrence frequency. Low-frequency branches are flagged as candidate exceptions.

**FR-7 Reconstruction & classification.** Segment each session into ordered steps (rules in §7); classify each into a step-signature, including `exception_branch` for low-frequency variant steps.

**FR-8 Suggestion + estimated saving.** Each step maps to a templated intervention + effort/impact + recommendation, plus an **estimated saving** = frequency × step duration × automatable fraction (from the taxonomy). Wait/handoff steps flagged as bottlenecks, steered to process redesign.

**FR-9 Map UI.** Interactive node-graph (pan/zoom, click-to-analyze) rendering the merged map: main path plus branches, branch frequency shown on edges, node states distinct (normal / AI-target / bottleneck / exception / active).

**FR-10 Register.** Add/remove opportunities to a running register showing intervention, impact, and estimated saving.

**FR-11 Automation brief.** For each register item, generate a structured brief: problem, trigger, inputs/outputs, systems touched, recommended approach, effort estimate, estimated saving.

**FR-12 Ticket export.** Export briefs as (a) JSON and (b) Jira/Linear-ready Markdown (title, description, acceptance-style checklist), so each becomes a groomable ticket.

**FR-13 ROI tracker.** Each opportunity has a status (identified → specced → shipped). On "shipped," the user records the realized saving. A ROI view aggregates: shipped count, hours saved, money saved, and estimate-vs-actual accuracy.

**FR-14 Consent screen.** First-run screen states what is/isn't captured and the principles; blocks capture until acknowledged.

**FR-15 Feedback.** Thumbs up/down per suggestion, stored locally (quality signal + future training data).

## 6. Technology decisions (detailed)

Choice → why → rejected alternative.

**6.1 Platform — Chrome MV3.** Only forward-compatible option; Chrome-only keeps surface small. *Rejected:* cross-browser (no demand yet).

**6.2 Architecture — content script + service worker + side panel + local storage, no server.** All capture/merge/reconstruction/suggestion/ROI runs client-side. *Why:* airtight privacy (no central data), no auth/infra on the critical path, faster ship. *Rejected:* cloud pipeline (unnecessary + privacy liability for single-user MVP).

**6.3 UI surface — Side Panel.** Stays open beside the app being recorded. *Rejected:* popup (closes on outside click); in-page overlay (fragile/intrusive).

**6.4 Capture — structured events, no values, no page content, no pixels.** Enough to reconstruct; trivial to mask; lightest build. Content masking + PII redaction added in v2 to close the on-screen-data hole. *Rejected:* screenshot/DOM-snapshot (heavy, privacy-fraught).

**6.5 Reconstruction & merge — rules-based, client-side.** Segmentation by page/submit/idle/domain; **merge by step alignment** (match on system + normalized label, position handled by a progressive LCS-style fold rather than baked into the key — see below). Testable against hand-made ground-truth and hand-merged maps. *Why:* cheap, debuggable, legible; a wrong-but-explainable map the user can fix beats an opaque one. *Rejected:* ML (no training data yet; premature). *As built: matching purely on "system + normalized label + literal position" (the original plan) broke the moment one session inserted or skipped a step, since every later step in that session shifted to a different position index. The shipped merge instead aligns by step identity independent of position, then resolves divergences (single-step swaps, equal-length multi-step swaps, and unequal-length/ragged swaps) as branches at the right point in the timeline. See `ARCHITECTURE.md` §7.3 — this substantially resolves open decision §13.3 below.*

**6.6 Front-end — Vite + `@crxjs/vite-plugin` + React + TypeScript.** Stateful interactive UI; typed schemas cut bugs in reconstruction/merge; crxjs is the MV3+Vite+HMR standard. *Rejected:* vanilla (state gets messy); Webpack (slower DX); Plasmo (heavier than needed).

**6.7 Graph — React Flow.** Purpose-built node graphs (pan/zoom/custom nodes/edge labels for branch frequency). *Rejected:* hand-rolled SVG (painful when live); D3/Cytoscape (lower-level/heavier).

**6.8 AI-opportunity layer — templated, offline.** Deterministic suggestions + savings math from the taxonomy. Offline, free, instant, privacy-clean, precision-controllable. *Rejected for MVP:* LLM suggestions (cost/latency/egress/hallucination — v2, for the judgment-on-text step).

**6.9 Ticket export — file/clipboard, not live API.** Markdown + JSON the user pastes or imports. *Why:* live Jira/Linear write needs OAuth + a backend, which breaks the no-server MVP. *Rejected:* direct API push (v2).

**6.10 Styling — plain CSS with mockup tokens.** Visual language already approved; port tokens. Portfolio rebrand later.

## 7. Reconstruction & merge rules (core logic)

**Segment** an event stream into steps; new step when: URL path changes, form submits, domain changes, or idle > `IDLE_MS` (default 8000). Flag `isCrossSystem` on domain change (esp. if a shared identifier preceded it).

**Classify** per §6-concept taxonomy heuristics. Add `exception_branch` when a step appears on a minority of sessions after merge.

**Merge** sessions of the same workflow: normalize each step to a key (system + normalized label + rough order); steps sharing a key collapse to one node with summed frequency; divergent keys become branches. Each edge carries `occurrenceCount / totalSessions`. Keep merge legible — surface a "these two steps were treated as the same" review so the user can correct bad alignments.

## 8. Data model

```
Workflow { id, name, sessions[], mergedGraph, register[], roi }

Session { id, workflowId, startedAt, endedAt, events[] }

CapturedEvent {
  id, ts, type, domain, urlPath,           // query stripped
  element: { role, label, tag },           // never value; label PII-redacted
  crossDomainFrom?
}

MergedNode (WorkflowStep) {
  id, order, label, system, signature, isCrossSystem,
  occurrence, totalSessions, isMainPath,   // frequency / branch info
  avgDurationMs,
  intervention, effort:1|2|3, impact:1|2|3,
  isOpportunity, isBottleneck, isException,
  suggestionText, estimatedSavingHrsPerMonth
}

Edge { from, to, occurrence, totalSessions }

Opportunity {
  stepId, label, intervention, impact,
  brief: { problem, trigger, inputs, outputs, systems, approach, effortEstimate },
  status: "identified"|"specced"|"shipped",
  estimatedSavingHrs, realizedSavingHrs?
}

ROI { shippedCount, hoursSaved, moneySaved, estimateVsActualPct }
```

## 9. Privacy & masking (first-class)

- Never read/store: input values, query strings, screenshots, page-content text from data regions.
- Step labels prefer roles/ARIA/stable selectors; any retained text is PII-redacted.
- **Pre-save privacy preview** shows exactly what will be stored; user can redact/discard.
- All data in `chrome.storage.local`; nothing transmitted.
- Consent screen + persistent recording reassurance.
- Rationale: for fintech buyers, "what exactly do you capture?" is deal-gating; the honest answer is "structurally, not the sensitive part."

## 10. Phased delivery plan (gates — do not pass a failed gate)

**Phases 0–6 are complete** (they map 1:1 onto `BUILD.md`'s M0–M8; see that file for exact gate-verification notes on each). Summary:

**Phase 0 — Foundations.** ✅ Scaffold Vite+crxjs+React+TS; MV3 manifest; side-panel shell; empty content script + service worker; typed data model; tokens.
*Gate:* loads unpacked; panel opens; content script injects.

**Phase 1 — Reconstruction spike (riskiest, throwaway).** ✅ Capture a raw stream from one real session; rules-based segmenter → rough step list; test vs. a hand-made ground-truth map.
*Gate:* reproduces ground-truth steps/order, minor errors only. **Fail → stop and rethink.**

**Phase 2 — Capture + masking + privacy preview.** ✅ Full masked capture (values + content + PII redaction); session store; privacy preview before save.
*Gate:* a recorded session stores correctly-masked events; preview shows no values/content; user can redact/discard.

**Phase 3 — Multi-session merge.** ✅ Name a workflow, record it ≥2×, merge into main-path-plus-branches with frequency; surface exception branches; merge-review to fix bad alignments.
*Gate:* merged map of 3 captures matches a hand-merged ground truth and surfaces a real variant a single session missed.

**Phase 4 — Map + analysis + register.** ✅ React Flow merged graph (custom nodes, edge frequency); analysis panel (signature, intervention, effort/impact, estimated saving, suggestion, add/dismiss, thumbs); register with estimated savings.
*Gate:* click node → analysis; add opportunities → register updates.

**Phase 5 — Brief + ticket export + ROI tracker.** ✅ Generate automation briefs; export JSON + Jira/Linear Markdown; opportunity status (identified→specced→shipped) with realized-saving entry; ROI view (shipped, hours, money, estimate-vs-actual).
*Gate:* an accepted opportunity → brief → valid ticket export → marked shipped with a realized saving → ROI view updates.

**Phase 6 — Consent, feedback, dogfood.** ✅ First-run consent; local metric counters; dogfood on messy real sessions; fix map/merge readability on real data.
*Gate:* full loop works on an unrehearsed workflow, consent-to-ROI. *Verified on a completely fresh browser profile — no rehearsal, no prior state.*

**Phase 7 — Design-partner beta + harden.** *Partially done.* Ship to 1–2 partners; weekly loop; precision over recall on suggestions; security review; then open v2 (live ticket API, LLM suggestions, more workflow types) from evidence.
- ✅ **Security review** — done as an internal code/architecture audit (not a third-party pen test): found and fixed a real capture-time privacy leak (structural ARIA roles exposing data-grid content), redaction gaps, a cross-tab data-bleed bug, and a service-worker resilience bug where one failure could permanently break the extension. See `ARCHITECTURE.md` §8 and `BUILD.md`'s "Post-MVP hardening."
- ⬜ **Ship to 1–2 design partners**, **weekly loop**, **precision-tune suggestions from real usage** — all genuinely need real users and real usage data; not something buildable in the abstract. This is the actual next phase.

## 11. Success metrics & instrumentation

- **North Star:** realized savings per account per month. *Shown directly in `RoiPanel` (hours/money saved).*
- **Loop-closure rate:** % of accepted opportunities reaching shipped + measured — the health metric; where prior tools died. *Instrumented (`lib/metrics.ts`); shown in the Metrics panel.*
- **Activation:** % of installs reaching a first (merged) map. *Instrumented as a flag (single-install MVP, so "%" is really "did this install reach one").*
- **Discovery quality:** thumbs-up rate on suggestions. *Instrumented — added during the post-MVP hardening pass; the raw per-node thumbs data existed since Phase 4 but wasn't aggregated into a rate until then.*
- **Merge validity:** does merge surface variants single sessions missed? *Verified by test (`merge.test.ts`, `merge-alignment.test.ts`), not a runtime UI metric — this is a property to keep testing for, not something to display a number for.*
- **Estimate accuracy:** estimated vs. realized savings delta (keeps ROI honest). *Instrumented as `estimateVsActualPct` in `RoiPanel`.*

Instrument locally (counters in storage); no analytics backend until warranted. *Still true — everything above reads from `chrome.storage.local`, nothing is transmitted anywhere.*

## 12. Risks

- **Reconstruction accuracy** — make-or-break; Phase 1 faces it first.
- **Merge correctness** — a bad merge is worse than none; hence the merge-review + Phase 3 ground-truth gate.
- **Savings honesty** — estimate-vs-actual guards against vanity ROI.
- **Suggestion credibility** — under-suggest with precision early.
- **Adoption** — worker-owned principles mitigate but don't eliminate resistance.

## 13. Open decisions needing sign-off

1. Pilot workflow = partner onboarding (confirm). *Still open — needs a real partner.*
2. Idle-gap threshold ~8s (tune on real data). *Still open — hardcoded as `IDLE_GAP_MS` in `segment.ts`, not exposed in the UI; needs real session data to tune.*
3. ~~Merge key: system + normalized label + order — is label normalization robust enough, or add manual step-matching from day one?~~ *Substantially resolved during the build: label normalization plus position-independent LCS-style alignment (not "order" baked into the key) correctly handles single-step swaps, equal-length multi-step swaps, and unequal-length/ragged swaps. The one residual gap is a multi-step gap where the alignment *within* the gap itself might not be the best possible pairing (still resolved positionally, front-to-back) — see `ARCHITECTURE.md` §7.3's "known residual limitation." Manual step-matching from the user is still not implemented; `MergeAlignment` data exists for it but there's no edit UI yet.*
4. Savings inputs: who supplies the hourly-cost figure for money-saved (buyer config), and default hours assumptions. *Partially resolved: the hourly-cost figure is a user-editable field in `RoiPanel` (defaulting to a placeholder, `DEFAULT_HOURLY_COST` in `roi.ts`), and `runsPerMonth` is a similar surfaced assumption in `savings.ts`. Still open: what the *right* defaults are, and whether a buyer-level (vs. per-user) config makes more sense — needs real customer input.*
5. MVP palette (diagnostic instrument) now, portfolio rebrand post-beta — confirm. *Still open — the shipped UI uses the MVP palette from `CLAUDE.md`/the mockup; no rebrand attempted.*
