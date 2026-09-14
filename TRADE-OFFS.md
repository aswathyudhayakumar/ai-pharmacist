# Trade-offs & Design Decisions

This document records the trade-offs made while building the AI Pharmacist layer — a
prototype agentic pharmacist worked *ambiently* into a Tata 1mg–style app, aimed at
lifting new-user adoption and repeat purchases (North Star: a second medicine purchase
within 30 days). `CLAUDE.md` is the requirements source of truth and its §12 table
captures the foundational platform decisions; this document restates those with their
reasoning and, more importantly, adds the architecture- and product-level trade-offs
that were actually decided *during* the incremental build (surfaces S1–S4 and the
agentic search layer).

## The one principle behind almost every call

This is a **regulated health domain**, so a hallucinated drug fact or an unauthorized
dispense is not a bug — it is a safety event. Nearly every trade-off below resolves the
same way: **correctness, safety, and explainability beat autonomy and polish.** The
recurring pattern is a clean division of labour —

> **Deterministic code owns the facts and the actions. The model composes and explains.
> Humans hold every gated action.**

Where a choice traded away "looks more impressive" or "feels more like a real autonomous
agent" in exchange for "is demonstrably safe and defensible," we took the latter — on
purpose.

---

## 1. Platform & stack

| Decision | Why | Cost accepted |
|---|---|---|
| Build in **Claude Code** (real code) rather than a no-code builder (e.g. Lovable) | Full control over agent wiring, guardrails, and accessibility — the reviewer cares *how* the agent is built, not just that a skin exists | Slower to a polished visual shell |
| **Claude** as the LLM | Strong structured tool-use and source-cited reasoning — which *is* the explainability requirement | Model choice barely matters functionally for a prototype |
| **Next.js (App Router) + server components + one API route** calling Claude | Standard, demonstrable, server-authoritative; nothing exotic to explain away | No streaming-agent framework flourish |
| **Front end mirrors 1mg** (coral palette, category strip, card surfaces) | The agent must feel *native* to an existing journey, not bolted on — that is the whole "ambient, not a destination" thesis | Real time spent on shell fidelity instead of features |
| **Mock everything except the novel core** — ABDM fetch, patient data, the KB, pharmacist identity, the phone call, payments/delivery are all mocked; **real** = Claude reasoning, the router/guardrails, the graph-overlay logic, the surfaces | Concentrates effort on the parts that are actually novel and defensible | Not an end-to-end real system |

---

## 2. How the LLM is wired (the agent architecture)

**Single shared `draft_recommendation` tool + eager, server-side resolution of the other
four tools — *not* a free multi-turn agentic tool-use loop.**
The documented contract lists five tools (`graph_query`, `kb_lookup`, `schedule_classify`,
`severity_score`, `draft_recommendation`). In practice the first four are resolved
deterministically in server code *before* the model is called, and the model is forced to
call only `draft_recommendation`.
- **Gained:** the facts the model reasons over are guaranteed correct — it cannot look up a
  wrong fact, skip a check, or invent a lookup result. Cheaper, faster, and fully
  demonstrable.
- **Cost accepted:** this is not a "real" autonomous agent loop — the model does not choose
  which tools to call, so part of the five-tool contract is documentary. For a safety-first
  prototype this is the right trade; a production version could open up a constrained,
  audited tool loop where genuinely needed.

**The model is a writer, boxed in a fixed form.** It selects among pre-computed findings
and writes prose; it never originates a drug fact (NFR-S1).
- **Gained:** every fact shown traces to the KB or graph and carries a "why?" citation.
- **Cost accepted:** requires a curated knowledge base; the model can't be "clever" beyond
  the facts it's handed.

**Server-authoritative graph.** The client sends only *which patient* and *which surface*;
all medical data is read from the server's own store, never from the request body.
- **Gained:** a tampered client cannot hand us a fabricated medication list and have it
  reconciled as fact.
- **Cost accepted:** a slightly less flexible API shape.

**Fixed demo "today" (2026-09-12) instead of wall-clock `new Date()`.** The seed data
calibrates all refill day-math to this date.
- **Gained:** the seeded narrative ("Amlodipine overdue by ~3 days") stays exact and
  reproducible in any demo.
- **Cost accepted:** the date is a constant to remember to move for a live-clock demo.

---

## 3. Safety & guardrails (the spine)

**Guardrails in code, not prompt (NFR-S2) — enforced two ways at once.**
1. *Structural:* there is simply no code path that dispenses, prescribes, approves a
   substitution, or changes a prescription. Human-only actions live in separate
   `"use server"` files that the agent route never imports (greppable, verifiable).
2. *Assertive:* `assertAgentCanPerform(action)` checks a hardcoded allowlist at the point of
   use and throws on anything gated.
- **Gained:** defense in depth — the model would have to reach code that does not exist, and
  a redundant tripwire sits at the effect site regardless.
- **Cost accepted:** the assertion never actually throws today (the actions asserted are all
  permitted), so it reads as partly future-proofing. That's deliberate, cheap insurance: it
  catches a *future* refactor that tries to do something gated with the model's output.

**The guard is placed *after* the model call, at the point of execution — not before.**
- **Gained:** it guards the moment the draft becomes a real effect (return/save/dispatch),
  which is the boundary the "draft, never execute" rule actually cares about.
- **Cost accepted:** looks redundant next to the structural block; justified as the tripwire's
  correct location.

**Router and permission guard are separate functions in one module — not merged.** They
answer different questions ("where does this *item* go?" vs. "may this *actor* do this
*action*?") with different inputs, return types, and failure modes.
- **Gained:** single-responsibility; each policy can be pointed at and defended on its own.
- **Cost accepted:** two concepts to learn instead of one; a stricter split would even put
  them in two files.

**No fake affordances.** Anything not really built is honestly disabled with an
accessible label (e.g. "Request pharmacist to call" is a disabled button whose `aria-label`
says the live handoff lands in a later phase), never a button that silently does nothing.
- **Gained:** honesty and accessibility; the demo never over-claims.
- **Cost accepted:** looks slightly less "finished."

---

## 4. Patient graph & knowledge base

**Two separate structures that meet: a per-patient graph and a patient-independent KB;
the agent overlays the KB onto the graph and never writes facts back into it (FR-G3).**
- **Gained:** general medical truth is retrieved, never generated; the value lives in the
  *edges* (interaction, duplication, contraindication, refill gap, cheaper generic).
- **Cost accepted:** two stores to keep coherent.

**Graph modeled as a typed node/edge store, not a real graph DB (e.g. Neo4j).**
- **Gained:** the *reasoning* is relational and demonstrated as such; no production-fragile
  infra stood up for a take-home.
- **Cost accepted:** not a "real" graph database — documented as the production choice.

**No-schedule-jargon rule.** `patientLegalStatusLabel` maps every drug schedule to plain
language ("Needs a doctor's prescription" / "No prescription needed") for patient-facing
copy; the raw schedule still drives routing internally and may be shown to a pharmacist.
- **Gained:** patients never see regulatory codes; the legal axis still works underneath.
- **Cost accepted:** an extra presentation layer and a rule the prompts must respect.

**Cold-start handled by ranked population sources (ABDM import → Rx upload → purchases →
manual); every surface works with an empty graph (NFR-D1).** ABDM-consent is the primary
seed where records exist.
- **Gained:** day-one value for patients with records, graceful degradation for those without.
- **Cost accepted:** ABDM coverage is partial, so the degradation paths are load-bearing, not
  optional.

---

## 5. Routing & permissions

**Two-axis hybrid routing: a deterministic *legal* axis (schedule lookup) + a
model-assessed but deterministically-*banded* *clinical* axis.**
- **Gained:** the legally consequential decision (does this need a pharmacist?) is never the
  model's to make, while clinical nuance still benefits from the model's scoring — but the
  model scores, a fixed threshold decides.
- **Cost accepted:** more engineering than a single classifier.

**Fixed severity thresholds (queue ≥ 40, live-call ≥ 80), with "moderate" deliberately
kept *under* the queue threshold.**
- **Gained:** an OTC item with a moderate interaction (e.g. Ibuprofen × Amlodipine)
  auto-surfaces with a cited caution rather than needlessly queuing; a serious finding still
  queues even for OTC.
- **Cost accepted:** the numbers are illustrative and hand-tuned, not clinically validated.

**Three routing *outcomes*, with the live pharmacist call always patient-reachable — not a
third scoring axis.**
- **Gained:** keeps the model clean (two axes score; three outcomes receive) and gives P2 and
  trust-sensitive users a standing "talk to a human" escape hatch.
- **Cost accepted:** a production live-call outcome needs a real pharmacist-staffing model.

---

## 6. Per-surface product decisions

**S1 — Prescription reconciliation.** The upload flow forks on the *legal axis*: an
all-non-prescription order is prepared for one-tap patient purchase; any prescription item
routes the whole order to the pharmacist queue, where the pharmacist (not the patient) sees
the clinical findings.
- **Trade-off:** clinical flags are deliberately hidden from the patient on the queue path
  (FR-R6) — correct routing over showing the patient everything.

**S2 — Search, rebuilt as an agentic overlay.** Originally a binary "trap match → safety
interstitial, else plain search." Rebuilt so the app's original catalogue search still does
retrieval and paints instantly, and the agent layer sits *on top*: deterministic graph-aware
flags per result, a **code-computed re-rank** (the model writes prose but can never reorder
or drop a flag), and streamed annotations.
- **Gained:** every search is enhanced (not just seeded queries); base results are never
  blocked on the model; the model cannot bury a safety warning.
- **Cost accepted:** an LLM call per submitted search adds a few seconds (mitigated by instant
  base render + streaming); the model can't do clever semantic ranking since order is code.

**S2 — Pharmacist-review alternative.** For a patient who has the condition's treatment on
file, the diabetes search also surfaces a prescription alternative (Glimepiride) that "could
fit but needs pharmacist review." The review requirement is *graph-derived* — it is
prescription-only (legal axis) **and** trips a seeded contraindication against the patient's
sulfa allergy.
- **Gained:** the "why review" is concrete and defensible, and it stays a *drafted*
  recommendation gated to a human — never an approval.
- **Cost accepted:** it is anchored to the seeded substitution-trap record, so it fires for
  the demo condition only; generalizing needs a curated indications table (see §7).

**S3 — Graph-aware Q&A: inform, never block.** Every real interaction/contraindication is
mandatory to surface, but the answer never disables "Add to cart."
- **Trade-off:** surface the caution with a cited "why" and let the patient decide, rather
  than the agent gating a purchase it has no authority to gate.

**S4 — Refills: a current-status snapshot, not a living dashboard.** "My medicines" shows
each maintenance med's run-out/overdue status computed from days-supply + last purchase; a
due/overdue med gets an agent refill proposal that *re-checks* the graph + KB first.
- **Trade-off (scope):** CLAUDE.md lists a "living My medicines dashboard" and
  "adherence-over-time" under *document, don't build*. We built the minimal current-status
  snapshot to honor the explicit request while staying near that boundary — no historical
  charting.
- **Trade-off (honesty):** **no auto-refill toggle was built.** An honest opt-in with a
  notify-and-skip window needs real background-job infrastructure this synchronous prototype
  doesn't have, and a toggle with nothing behind it would be a fake affordance. The core
  requirement — *never silently reships* — is fully satisfied by the manual, one-tap-only
  design.

---

## 7. Scope boundaries — deliberately *not* built (and why)

| Not built | Why it was left out |
|---|---|
| General "what treats condition X" symptom→drug search | A model-generated "what cures X" is exactly the hallucination/safety event the design forbids. Doing it safely needs a curated indication→drug KB plus pharmacist oversight — documented as the next data asset, not faked |
| Caregiver / manage-on-behalf-of profiles | Documented extension; not on the two-persona critical path |
| Voice-into-search | In scope only if time allowed; documented as an accessibility modality |
| Adherence tracking over time | Needs historical modeling beyond a prototype snapshot |
| Live ABDM integration | Simulated; the consent → populate arc is shown without a real ABDM connection |
| Children's (<18) verifiable parental consent | Documented regulatory edge, not built |

The discipline here is itself a trade-off: **hold the line at the three heroes + human
paths, and document everything else** rather than half-build a dozen surfaces.

---

## 8. Known limitations (honest gaps)

- **Cart prices at brand price.** The generic price shown in a refill/search proposal does
  not carry through to the cart total — a pre-existing limitation of the mocked cart, not
  refactored for these features.
- **`isGatedAction` is currently unused.** It's exported but no UI-facing "is this disabled"
  check consumes it yet; disabled states are hand-authored per surface.
- **Thresholds and KB facts are illustrative,** not a clinical source — stated in the seed
  files themselves.
- **One LLM call per agent surface interaction;** no caching or batching. Fine for a demo,
  a cost/latency item for scale.

---

## 9. Engineering process trade-offs

- **Each surface shipped on its own branch + PR, verified live in a browser before merge.**
  More process overhead, but every change is small, reviewable, and independently defensible.
- **Reuse over duplication where it's safe:** the same deterministic graph-vs-salt check
  (`buildProductQaCandidates`) backs S3, S4's re-check, and the S2 search overlay — one source
  of truth for "does this drug clash with the patient's graph."
- **…but a fresh helper over a risky retrofit where it isn't:** S4's `priceWithCheapestGeneric`
  is a small new function rather than a retrofit of the shipped S1 pricing logic — a little
  duplication accepted to avoid regressing already-verified code.
