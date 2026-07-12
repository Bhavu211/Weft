# Weft — Product Concept (v0.2)

*From "where does AI belong?" to "what did it actually save?" — the closed loop.*

> v0.2 changelog: Weft is no longer a discovery tool that ends at a slide. It now closes the loop — **discover → spec → hand off → measure** — adds multi-session mapping so the output is trustworthy, hardens privacy to page content (not just form fields), adopts worker-owned consent principles, and carries a business model and a moat. See "What changed and why" at the end.

---

## One-liner

Weft observes people doing real work, reconstructs the true (multi-path) workflow, pinpoints where AI or automation belongs, hands each opportunity to the team as a ready-to-build spec, and then **measures the time and cost actually saved** — closing the loop from insight to outcome.

## The problem (sharpened)

Three gaps sit on top of each other, and most tools only address the first:

1. **Nobody knows how the work is really done.** The true process lives in muscle memory across several web apps; documented SOPs are fiction.
2. **Insight dies in a slide.** Even when you find the inefficiency, the distance from "here's an opportunity" to someone actually building the fix is where 90% of optimization efforts quietly expire. A recommendation nobody implements has produced zero value.
3. **Nobody proves it worked.** Optimization is bought on ROI, yet almost no one closes the loop from "we changed X" to "it saved ₹Y / Z hours." Without that, there's no renewal case and no honest scorecard.

Process-mining tools (Celonis, UiPath) attack gap 1 with heavy, IT-led, six-figure deployments — and stop there. Weft attacks all three, lightly, from the front end.

## Who it's for

- **User (does the work / runs discovery):** an ops or transformation analyst who records workflows and reviews opportunities.
- **Economic buyer (writes the cheque):** Head of Operations / Transformation / the COO's office — someone measured on efficiency and cost, who needs the ROI story Weft produces.
- **Wedge segment:** mid-market teams and departments that Celonis/UiPath structurally ignore because those tools are enterprise-only and heavy. Self-serve, front-end, and cheap is a segment the incumbents can't serve without cannibalizing their model.

## Principles (non-negotiable, because this product watches people work)

Weft studies work, not workers. These are product constraints, not marketing:

- **Worker-initiated, always.** Capture only ever starts from the person doing the task, on their own click. Never covert, never remotely triggered by a manager.
- **Worker-owned.** The person reviews exactly what was captured and can redact or delete it *before* anything is shared. Sharing is opt-in.
- **No individual performance metrics.** Weft never produces per-person productivity, speed, or keystroke scores, and never will. Timing data is used only to find process bottlenecks, never to rate a human.
- **Privacy by structure.** The safest data is the data never collected (see mechanism). We design so the sensitive part *can't* be captured, rather than promising to protect it after.

These principles also defuse the biggest adoption and legal risk: recording workers is regulated (EU works councils; varying rules across India, Singapore, Dubai). Worker-initiated, worker-owned, local-only capture sidesteps most of it and gives enterprise sales a clean compliance path.

## The mechanism — observer, worker-owned, structurally private

A browser-side observer, not an agent that logs in for you. The user is already logged in; Weft watches while *they* work.

- **No credentials** are ever collected or stored.
- **No values, no page content, no screenshots.** Weft captures the *structure* of the workflow — which step, which system, what kind of action — using stable element roles/labels, not the data on screen. Anything textual that is captured passes a PII-redaction pass, and a **privacy preview** shows the user exactly what will be stored before it's saved. (This closes the earlier hole where on-screen content — a customer name in a heading, an account number in a table — could leak even when form values were masked.)
- This sidesteps MFA, CAPTCHAs, bot-detection, and ToS violations that would break any "give us your password" approach.

## Core flow (the closed loop)

1. **Capture** — user records a task once. And, crucially, **records it a few times** (or several people do), because one recording is one person's happy path.
2. **Merge** — Weft aligns the sessions into a single map showing the **main path plus variant branches**, with how often each path occurs. The rare branches are where exceptions — and the real cost — hide.
3. **Analyze** — each step is classified and gets an AI/automation suggestion with an effort/impact read and an **estimated saving**.
4. **Spec** — for each opportunity the user keeps, Weft generates an **automation brief**: what to automate, the systems and data involved, a suggested approach, and an effort estimate — a document engineering or an automation team can actually act on.
5. **Hand off** — the brief exports as a groomable ticket (Jira/Linear-ready) so it enters a real backlog instead of a dead PDF.
6. **Measure** — when an opportunity is marked implemented, Weft tracks the **realized saving** and rolls it into an ROI view: opportunities shipped, hours saved, money saved.

Steps 4–6 are the difference between a tool that generates insight and a tool that generates outcomes.

## The differentiated core — the AI-opportunity layer

Each captured step is classified by a **step-signature taxonomy**; the signature maps to a likely intervention:

| Step signature | What it looks like | Likely intervention |
|---|---|---|
| Repetitive + rule-based | Same data entered the same way every time | RPA / scripted automation |
| Copy between systems | Manual re-keying from system A into B | Integration / API bridge |
| Judgment on unstructured text | Reading a doc/email and deciding or summarizing | LLM assist |
| Lookup / verification | Checking a value against another source | Automated validation |
| Wait / handoff | Idle time pending someone else | Process redesign (not tech) |
| Approval / decision | Human sign-off on a threshold | Policy automation + exception routing |
| **Exception branch** *(new — from merge)* | A low-frequency variant path | Often the highest-value target — exception handling / triage |

Multi-session merge adds that last row: exceptions only become visible once you've seen the workflow more than once, and they're frequently where the expensive, automatable mess lives.

## From insight to action (solving the implementation gap)

An accepted opportunity produces an **automation brief** — a short, structured spec: the problem, the trigger, inputs and outputs, systems touched, a recommended approach (from the taxonomy), an effort estimate, and the estimated saving. That brief exports as a ticket a team can groom. Weft does **not** build the automation — it recommends and specs; humans decide and implement. But it closes the gap to "a ticket in a real backlog," which is where most tools fail.

## The ROI loop (solving the measurement gap)

Every opportunity carries an **estimated** saving at discovery (from step frequency × duration × the fraction automatable). When it's marked implemented, Weft captures the **realized** saving and aggregates: shipped count, hours saved, money saved, estimate-vs-actual accuracy. This is the renewal engine — the answer to "did it work?" — and, not coincidentally, the raw material of the moat.

## Business model

- **Land:** free / low-cost self-serve for a single workflow — discovery is the wedge.
- **Expand:** paid per-team, priced against value delivered (opportunities implemented / hours saved), not seats. Charging on the outcome aligns price with the ROI the buyer already cares about.
- **Buyer:** the ops/transformation leader who needs the savings *and* the evidence.

## Moat & positioning

The map is table stakes; task mining already exists. The defensibility comes from the closed loop:

- **A compounding outcome-data asset.** Every captured session, every thumbs-up/down, and — uniquely — every *implemented-and-measured* result teaches Weft which step patterns lead to interventions that **actually saved money**. Over time that's not a process map; it's an *outcome graph* incumbents don't have, because their tools stop at discovery and never see the realized result.
- **A segment incumbents can't reach.** Front-end, self-serve, mid-market — structurally off-limits to a six-figure enterprise motion.
- **Positioning:** not "task mining + AI," but **the outcome layer** — from discovery to measured improvement, closing the loop the incumbents leave open.

## Why now

- LLMs make the "judgment on unstructured text" category newly automatable — the opportunity space is bigger than two years ago.
- Every company has an "identify AI use cases" mandate and no rigorous method.
- Browser + session-capture tech is mature and cheap, making the safe observer model buildable by a small team.

## MVP scope

**In:**
- Chrome extension, worker-initiated capture, structural + content-safe (values *and* page content masked, PII-redacted, privacy preview)
- **Multi-session capture + merge** into a main-path-plus-variants map with branch frequency
- Step classification (incl. exception branches) + templated AI-opportunity suggestions with estimated savings
- Automation-brief generation + ticket export (Jira/Linear-ready Markdown/JSON)
- ROI tracker (estimated + realized savings, local)
- Interactive map, analysis panel, opportunity register, consent + privacy-preview surfaces
- Fully local (no backend)

**Out (deliberately):**
- Autonomous login / credential handling — never
- Backend log ingestion (Celonis's game)
- LLM-generated suggestions (v2; taxonomy templates for MVP)
- Auto-implementing any automation — Weft specs and measures; humans build
- Direct write-API push to Jira/Linear (MVP exports a ticket; live API sync needs a backend — v2)
- Individual performance analytics — never, by principle

## Success metrics

- **North Star:** **realized savings per account per month** (was "opportunities exported" — engagement, not value; now tied to outcome).
- **Activation:** % of installs completing a first capture and reaching a map.
- **Loop-closure rate:** % of accepted opportunities that reach "implemented + measured." *This is the health metric that matters most* — it's where every prior tool failed.
- **Discovery quality:** % of suggestions rated worth pursuing (thumbs up/down) — also the moat's training signal.
- **Merge validity:** does the merged map surface variants a single session missed?

## Risks & open questions

- **Reconstruction accuracy** — still the make-or-break; face it first (validation §).
- **Merge correctness** — aligning steps across sessions is non-trivial; a bad merge is worse than no merge.
- **Realized-savings honesty** — estimated savings are easy to inflate; the estimate-vs-actual check keeps the ROI story credible. Guard against vanity math.
- **Suggestion credibility** — under-suggest with high precision early.
- **Adoption despite good principles** — "record yourself working" still meets resistance; framing and worker ownership are the mitigation, not a guarantee.

## How I'd validate this — riskiest assumption first

Sequence tests by what would kill the product, cheapest first, with kill criteria set *before* each test.

| # | Riskiest assumption | Cheapest honest test | Proceed if |
|---|---|---|---|
| 1 | A click-stream becomes a *readable, correct* map | Reconstruct 10 real sessions by hand; show them back | ≥8/10 rated "that's right" |
| 2 | Merging sessions surfaces real variants, not noise | Hand-merge 3 captures of one workflow; check if exceptions appear | Variants found match what practitioners confirm exist |
| 3 | Suggestions are useful, not noise | Concierge-generate the register from the taxonomy; ops leads rate it | ≥60% useful, <1 embarrassing per workflow |
| 4 | **Teams will actually act on a brief** | Hand a generated automation brief to an eng/ops team; see if it enters a backlog | ≥2 briefs become real tickets someone owns |
| 5 | **Realized savings can be measured credibly** | For 2 implemented items, track estimate vs. actual with the team | Estimates land within a defensible range; team trusts the number |
| 6 | There's a buyer with budget | Pitch the ROI view as the product output; ask "pay how much, from whose budget?" | ≥2 credible "yes, from [budget]" |

Tests 1–5 need a screen recorder, a spreadsheet, and me doing by hand what the software will do. Assumptions 4 and 5 are new to v0.2 and are now core — the whole "closed loop" thesis rests on them, so they get validated, not assumed.

## What changed and why (v0.1 → v0.2)

Six gaps were raised in review; each was solved at the altitude that fits, not all crammed into the MVP:

1. **Implementation gap** → MVP now generates automation briefs and ticket hand-offs (build stays out of scope).
2. **Single-session invalidity** → multi-session merge promoted *into* the MVP; exceptions become first-class targets.
3. **No business model / ROI** → business model added; ROI loop built into MVP; North Star flipped to realized savings.
4. **Privacy hole (page content)** → masking extended to on-screen content + PII redaction + a pre-save privacy preview.
5. **Surveillance dynamic** → worker-initiated/worker-owned principles and a no-performance-metrics guarantee, plus the regulatory path.
6. **No moat** → the compounding outcome-data asset + the mid-market wedge + the "outcome layer" positioning.

The disciplined part is the sorting itself: #2 and #4 earned MVP slots because the product is invalid or unsellable without them; #1 and #3 got right-sized MVP features with the expensive half deferred; #5 and #6 are principles and strategy, not build. Knowing which gap belongs at which altitude is the actual PM work.
