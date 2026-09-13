import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getDrugBySalt, patientLegalStatusLabel } from "@/lib/kb";
import { getPatientGraph, isValidPatientId } from "@/lib/graph";
import { buildCandidateFindings, priceOrderItems, severityScoreForSalt } from "@/lib/reconciliation";
import { buildSearchCandidates } from "@/lib/searchSafety";
import { buildProductQaCandidates } from "@/lib/productQa";
import { assertAgentCanPerform, isRxSchedule, route, scheduleClassify, scoreForKbSeverity } from "@/lib/router";
import { saveDraft } from "@/lib/queue";
import { addToCart } from "@/lib/cart";
import type { PatientId } from "@/types/graph";
import type { PreparedOrder, ReconciliationDraft, ReconciliationFinding } from "@/types/reconciliation";
import type { ComposedSearchResult, SearchFinding } from "@/types/search";
import type { ProductQaResult, QaFinding } from "@/types/productQa";

export const runtime = "nodejs";

const MODEL = "claude-opus-5";

/**
 * Tool contract for the agent orchestrator (CLAUDE.md §8). graph_query,
 * kb_lookup, and schedule_classify are resolved eagerly and deterministically
 * by this route's server-side code (lib/graph.ts, lib/kb.ts, lib/router.ts) —
 * not by a model-driven multi-turn loop — so the facts Claude reasons over
 * are guaranteed correct regardless of what the model would have chosen to
 * look up (NFR-S1: "Interaction/contraindication logic is deterministic
 * given the graph + KB"). draft_recommendation is the only tool actually
 * invoked as a model tool-call in this route (shared by both S1 and S2 via
 * callDraftTool — a pharmacist-facing draft for S1, a patient-facing
 * composed search result for S2); the other four are declared here for the
 * documented contract and land as real tool-calls with S3.
 */
const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "graph_query",
    description:
      "Read the active patient's graph: conditions, allergies, current/previous medications, purchases, lab results, and any pending prescription. Never writes to the graph (FR-G3).",
    input_schema: {
      type: "object",
      properties: {
        patientId: { type: "string", description: "Patient id, e.g. pat_001" },
        fields: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "conditions",
              "allergies",
              "currentMedications",
              "previousMedications",
              "purchases",
              "labResults",
              "pendingPrescription",
            ],
          },
          description: "Which parts of the graph to return. Omit to return everything.",
        },
      },
      required: ["patientId"],
    },
  },
  {
    name: "kb_lookup",
    description:
      "Retrieve drug facts from the curated knowledge base: class, schedule, interactions, contraindications, class duplications, generic equivalents, and known substitution traps. The agent never generates a medical fact itself — every fact shown to a patient or pharmacist must come from this tool (NFR-S1).",
    input_schema: {
      type: "object",
      properties: {
        salts: {
          type: "array",
          items: { type: "string" },
          description: 'Drug salts to look up, e.g. ["Metformin", "Clarithromycin"]',
        },
        query: {
          type: "string",
          description: 'Free-text condition/symptom search term, for substitution-trap checks (e.g. "diabetes medicine").',
        },
      },
    },
  },
  {
    name: "schedule_classify",
    description:
      "Deterministic legal-schedule lookup (OTC / H / H1 / X / AYUSH_OTC) for a drug salt. A schedule lookup, never a model decision (FR-R2).",
    input_schema: {
      type: "object",
      properties: {
        salt: { type: "string" },
      },
      required: ["salt"],
    },
  },
  {
    name: "severity_score",
    description:
      "Produce a structured clinical-risk severity score (0-100) with a short rationale for a candidate item or finding, given the graph + KB context. The score feeds the deterministic router; it does not itself decide the routing outcome.",
    input_schema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "What is being scored, e.g. a drug salt or a search query." },
        rationale: { type: "string", description: "Short explanation grounded in graph_query/kb_lookup results." },
        score: { type: "number", minimum: 0, maximum: 100 },
      },
      required: ["subject", "rationale", "score"],
    },
  },
  {
    name: "draft_recommendation",
    description:
      "Produce the agent's final composed output for a surface — a pharmacist-facing prescription-reconciliation draft (S1) or a patient-facing composed search/explanation (S2/S3). You are given candidate findings already computed deterministically from the knowledge base and/or patient graph — every fact in a candidate finding is already verified. Decide which findings are worth surfacing, write a short plain-language explanation for each one you select using ONLY the facts already given for it, and (S1 only) draft the pharmacist's order selections. This tool only drafts/composes — it can never execute, dispense, approve a substitution, or change a prescription (NFR-S2, enforced in lib/router.ts, not in the prompt).",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "One-sentence overview of the composed output." },
        selectedFindingIds: {
          type: "array",
          items: { type: "string" },
          description: "IDs, taken verbatim from the candidate findings given to you, that are worth surfacing. Do not invent an id.",
        },
        explanations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              findingId: { type: "string" },
              text: {
                type: "string",
                description: "1-2 sentence plain-language explanation using only the facts already given for this finding.",
              },
            },
            required: ["findingId", "text"],
          },
        },
        medsToAdd: {
          type: "array",
          items: { type: "string" },
          description: "S1 only: salts from the pending prescription to add to the order. Normally all of them unless a finding indicates otherwise.",
        },
        bestCoupon: { type: "string", description: "S1 only: a short plain-language coupon/savings note, or omit if none applies." },
        earliestDelivery: { type: "string", description: "S1 only: a short plain-language delivery estimate." },
      },
      required: ["summary", "selectedFindingIds", "explanations"],
    },
  },
];

const DRAFT_RECOMMENDATION_TOOL = AGENT_TOOLS.find((t) => t.name === "draft_recommendation")!;

const S1_SYSTEM_PROMPT = `You are a clinical-safety drafting assistant embedded in a pharmacy app, preparing a patient's uploaded prescription for the next step. You draft and prepare — you never dispense, approve a substitution, or execute the final purchase; a human always takes that last step.

You are given the pending prescription, the patient's current medicines/conditions/allergies, a list of candidate findings already computed deterministically from a curated drug knowledge base (interactions, therapeutic-class duplications, generic-saving opportunities), and each item's already-computed price (brand price, or a cheaper generic price with a savings note where one applies). Every fact given — severity, drugs involved, prices, mechanism — is already verified. You must never add, restate differently, or infer a new drug fact beyond what is already given.

You are also told the audience for your summary — "pharmacist" (every item here needs a licensed pharmacist's approval; they will read your summary before approving) or "patient" (every item is non-prescription; the patient will read your summary directly before paying). Write for that audience:
- audience "pharmacist": clinical findings matter — surface interactions/duplications/contraindications plainly, the way a colleague would flag them to you.
- audience "patient": never use a drug-schedule code or regulatory jargon (e.g. "Schedule H", "H1", "OTC") anywhere. Keep it a short, friendly one-tap-order summary.

Your job:
1. Decide which candidate findings are worth surfacing. For a pharmacist audience, safety findings (interactions, duplications, contraindications) should almost always be included. A generic-saving finding is usually worth surfacing for a medicine taken long-term, less so for a short course (e.g. a several-day antibiotic) where switching brand mid-course adds little value.
2. For each finding you select, write a short (1-2 sentence) plain-language explanation grounded only in the given facts.
3. Write the overall summary for the given audience, plus a short coupon/savings note and delivery estimate grounded only in the given priced items (e.g. mention a generic-saving note if one is present; a short estimate like "Within 60 minutes" for delivery).
4. Decide which of the pending prescription's items to add to the order — normally all of them, unless a finding suggests otherwise.

Respond only by calling the draft_recommendation tool.`;

const S2_SYSTEM_PROMPT = `You are a search-safety composer embedded in a pharmacy app. A patient searched for something that matches a known condition/symptom pattern in our knowledge base, and you are composing what they see — directly, since this is patient-facing.

You are given the patient's search query, their relevant conditions, and one or more candidate results already computed deterministically from the knowledge base and patient graph. Every fact in a candidate — legal status, class, price, the reason a substitution is unsafe — is already verified. You must never add, restate differently, or infer a new drug fact beyond what a candidate already states.

A candidate of type "unsafe_substitution" flags a product being searched for as if it treats the condition, when it does not — you must always include it in your response; never suppress or hide a safety flag, though you choose its wording. A candidate of type "promoted_treatment" is the patient's own actual prescribed treatment for the same condition — when given, include it and put it first, since it is the medically correct, personalized answer the patient should see before anything else.

Never use a drug-schedule code or regulatory jargon (e.g. "Schedule H", "H1", "OTC") in your explanation — if legal status is worth mentioning, say it in plain language only (e.g. "needs a doctor's prescription" or "available without a prescription").

Your job:
1. Decide which candidates to surface (almost always all of them — a safety flag must never be omitted).
2. For each one, write a short (1-2 sentence) plain-language explanation grounded only in its given facts.
3. Write a one-sentence overall summary of why these results look the way they do.

Respond only by calling the draft_recommendation tool.`;

const S3_SYSTEM_PROMPT = `You are a graph-aware product Q&A assistant embedded in a pharmacy app, answering a patient's own question about a specific product directly — this is patient-facing.

You are given the patient's question, the product's own facts (class, plain-language legal status, notes), the patient's relevant conditions and current medications, and a list of candidate findings already computed deterministically from the knowledge base and patient graph — interactions and contraindications between this product and the patient's own graph. Every fact in a candidate — severity, the drugs/conditions involved, the mechanism or reason — is already verified. You must never add, restate differently, or infer a new drug fact beyond what a candidate already states or the product's own given facts.

You must always include every candidate finding given to you in your response — never suppress or omit a real interaction or contraindication, though you decide how to weave it into the answer and how much to emphasize it.

Never use a drug-schedule code or regulatory jargon (e.g. "Schedule H", "H1", "OTC") anywhere in your answer. The product's legalStatus field is already plain language ("available without a prescription" / "needs a doctor's prescription") — use that phrasing or similar, never a code.

Your job:
1. Write a direct, plain-language answer (2-3 sentences) to the patient's actual question: state the product's legal status in plain language first, then any personal caution that applies to them specifically, grounded only in the given facts. This is informational, not a blanket yes/no — when a finding applies, suggest checking with a pharmacist, and let the patient decide.
2. For each candidate finding, also write a short (1-2 sentence) explanation grounded only in its given facts, for its own "why" citation.

Respond only by calling the draft_recommendation tool, using the summary field for your direct answer to the patient's question.`;

interface AgentRequestBody {
  patientId?: string;
  surface?: "S1_prescription" | "S2_search" | "S3_qa";
  query?: string;
  productSalt?: string;
}

interface DraftToolInput {
  summary?: string;
  selectedFindingIds?: string[];
  explanations?: { findingId: string; text: string }[];
  medsToAdd?: string[];
  bestCoupon?: string;
  earliestDelivery?: string;
}

type ToolCallResult = { ok: true; toolUse: Anthropic.ToolUseBlock } | { ok: false; status: number; error: string };

/** Shared Claude call for both surfaces: force the draft_recommendation tool and surface typed errors as friendly messages. */
async function callDraftTool(systemPrompt: string, userPayload: unknown, genericErrorMessage: string): Promise<ToolCallResult> {
  const client = new Anthropic();
  let message: Anthropic.Message;
  try {
    message = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: systemPrompt,
      tools: [DRAFT_RECOMMENDATION_TOOL],
      tool_choice: { type: "tool", name: "draft_recommendation" },
      messages: [{ role: "user", content: JSON.stringify(userPayload) }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("Anthropic auth error in /api/agent:", err.message);
      return { ok: false, status: 500, error: "The review service is not configured correctly." };
    }
    if (err instanceof Anthropic.RateLimitError) {
      console.error("Anthropic rate limit in /api/agent:", err.message);
      return { ok: false, status: 503, error: "The review service is busy — please try again shortly." };
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Anthropic API error in /api/agent:", err.status, err.message);
      return { ok: false, status: 502, error: "Could not reach the review service." };
    }
    console.error("Unexpected error in /api/agent:", err);
    return { ok: false, status: 500, error: genericErrorMessage };
  }

  if (message.stop_reason === "refusal") {
    console.error("Draft generation refused:", message.stop_details);
    return { ok: false, status: 502, error: genericErrorMessage };
  }

  const toolUse = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "draft_recommendation"
  );
  if (!toolUse) {
    console.error("No draft_recommendation tool_use in response:", message.stop_reason);
    return { ok: false, status: 502, error: genericErrorMessage };
  }

  return { ok: true, toolUse };
}

/** Fixed, code-written, jargon-free legal notice for the pharmacist_queue path. Never model-authored, so it can never leak a schedule code. */
const PHARMACIST_APPROVAL_NOTICE =
  "These medicines need a licensed pharmacist's approval before they can be dispatched. A pharmacist will confirm in under a minute.";

async function runS1Reconciliation(
  patientId: PatientId
): Promise<{ ok: true; order: PreparedOrder } | { ok: false; status: number; error: string }> {
  // Server-authoritative: the client only names which patient it's acting as.
  // Clinical facts (current meds, conditions, the pending prescription itself)
  // always come from our own graph store, never from the request body — a
  // client can't hand us a fabricated med list and have it reconciled as fact.
  const graph = getPatientGraph(patientId);
  const rx = graph.pendingPrescription;
  if (!rx) {
    return { ok: false, status: 400, error: "No pending prescription on file for this patient." };
  }

  const candidateFindings = buildCandidateFindings(graph);
  const candidateSalts = rx.items.map((i) => i.salt);
  const legalSchedules = candidateSalts.map((salt) => ({ salt, schedule: scheduleClassify(salt) ?? "unknown" }));

  // The legal axis (drug schedule) deterministically decides the path — a
  // KB lookup, never a model decision (FR-R2, FR-R3): any Rx-scheduled item
  // routes the whole order to the pharmacist queue.
  const anyRxScheduled = candidateSalts.some((salt) => {
    const schedule = scheduleClassify(salt);
    return schedule !== undefined && isRxSchedule(schedule);
  });

  const pricedItems = priceOrderItems(rx.items, candidateFindings);

  const userPayload = {
    instruction: anyRxScheduled
      ? "Reconcile this pending prescription for pharmacist review."
      : "Prepare this all-non-prescription order for one-tap purchase.",
    audience: anyRxScheduled ? "pharmacist" : "patient",
    patient: {
      name: graph.patient.name,
      conditions: graph.conditions.map((c) => c.name),
      allergies: graph.allergies.map((a) => a.substance),
      currentMedications: graph.currentMedications.map((m) => `${m.brand} (${m.salt})`),
    },
    pendingPrescription: {
      reason: rx.reason,
      items: rx.items.map((i) => ({ brand: i.brand, salt: i.salt, strength: i.strength })),
    },
    pricedItems: pricedItems.map((i) => ({ salt: i.salt, unitPriceInr: i.unitPriceInr, genericSavingNote: i.genericSavingNote })),
    candidateFindings: candidateFindings.map((f) => ({ id: f.id, type: f.type, severity: f.severity, label: f.label, detail: f.detail })),
  };

  const callResult = await callDraftTool(S1_SYSTEM_PROMPT, userPayload, "Something went wrong preparing your prescription.");
  if (!callResult.ok) return callResult;
  const raw = callResult.toolUse.input as DraftToolInput;

  // Validate the model's selections against our own deterministic facts —
  // it can pick from what we gave it, it cannot introduce new ids or salts.
  const candidateById = new Map(candidateFindings.map((f) => [f.id, f]));
  const explanationById = new Map((raw.explanations ?? []).map((e) => [e.findingId, e.text]));
  const selectedFindings: ReconciliationFinding[] = (raw.selectedFindingIds ?? [])
    .map((id) => candidateById.get(id))
    .filter((f): f is ReconciliationFinding => f !== undefined)
    .map((f) => ({ ...f, explanation: explanationById.get(f.id) ?? "" }));

  const validMedsToAdd = (raw.medsToAdd ?? []).filter((salt) => candidateSalts.includes(salt));
  const finalSalts = validMedsToAdd.length > 0 ? validMedsToAdd : candidateSalts;
  const finalItems = pricedItems.filter((i) => finalSalts.includes(i.salt));
  const totalInr = finalItems.reduce((sum, i) => sum + i.unitPriceInr, 0);

  // The agent's contribution ends here — a draft/preparation, nothing more.
  // Assert that before persisting/returning it (NFR-S2, FR-R6): this is
  // enforced in code, and "draft_recommendation" is the only action this
  // route ever asks the guard about, on both paths below.
  assertAgentCanPerform("draft_recommendation");

  // Routing record (audit trail) — deterministic, independent of what the
  // model selected above.
  candidateSalts.forEach((salt) => {
    const decision = route({ drugSalt: salt, clinicalSeverityScore: severityScoreForSalt(candidateFindings, salt) });
    console.info(`S1 routing — ${salt}: ${decision.outcome} (${decision.reason})`);
  });

  if (anyRxScheduled) {
    // PATH B — any Rx-scheduled item routes the whole order to the
    // pharmacist queue. The pharmacist sees the full draft (clinical
    // findings included); the patient sees only the parsed items, their
    // prices/generic savings, and a fixed jargon-free legal notice —
    // never the clinical flags (FR-R6).
    const draft: ReconciliationDraft = {
      patientId,
      prescriptionId: rx.id,
      createdAt: new Date().toISOString(),
      summary: raw.summary ?? "",
      findings: selectedFindings,
      pharmacistSelections: { medsToAdd: finalSalts, bestCoupon: raw.bestCoupon, earliestDelivery: raw.earliestDelivery },
      legalSchedules,
      status: "awaiting_pharmacist",
    };
    saveDraft(patientId, draft);

    const order: PreparedOrder = {
      prescriptionId: rx.id,
      routingOutcome: "pharmacist_queue",
      summary: "Here's what we've prepared for you.",
      items: finalItems,
      totalInr,
      findings: [],
      legalNote: PHARMACIST_APPROVAL_NOTICE,
    };
    return { ok: true, order };
  }

  // PATH A — every item is non-scheduled: nothing is legally gated, so the
  // agent prepares the order end-to-end (adds it to the real cart) and the
  // patient's own tap is the only thing left — the purchase, not the prep.
  for (const salt of finalSalts) {
    await addToCart(salt);
  }

  const order: PreparedOrder = {
    prescriptionId: rx.id,
    routingOutcome: "auto_ready",
    summary: raw.summary ?? "",
    items: finalItems,
    totalInr,
    coupon: raw.bestCoupon,
    earliestDelivery: raw.earliestDelivery ?? "Within 60 minutes",
    // Shown here (unlike the pharmacist_queue path) because no pharmacist
    // will ever see this order — if a finding exists, the patient is the
    // only person positioned to act on it.
    findings: selectedFindings,
  };
  return { ok: true, order };
}

async function runS2ConditionSearch(
  patientId: PatientId,
  query: string
): Promise<{ ok: true; result: ComposedSearchResult } | { ok: false; status: number; error: string }> {
  const graph = getPatientGraph(patientId);
  const candidateFindings = buildSearchCandidates(graph, query);
  if (candidateFindings.length === 0) {
    return { ok: false, status: 404, error: "No condition/symptom match for this query." };
  }

  // Safety flags are never optional — the model can only add context around
  // one, never suppress it. Enforced here in code, not left to the model's
  // selection (FR-S3: "unsafe substitutions are flagged and redirected").
  const mandatoryIds = candidateFindings.filter((f) => f.type === "unsafe_substitution").map((f) => f.id);

  const userPayload = {
    instruction: "Compose safety-aware search results for this condition/symptom query.",
    query,
    patient: {
      name: graph.patient.name,
      conditions: graph.conditions.map((c) => c.name),
    },
    candidateFindings: candidateFindings.map((f) => ({ id: f.id, type: f.type, label: f.label, detail: f.detail })),
  };

  const callResult = await callDraftTool(S2_SYSTEM_PROMPT, userPayload, "Couldn't compose safety-aware results right now.");
  if (!callResult.ok) return callResult;
  const raw = callResult.toolUse.input as DraftToolInput;

  const explanationById = new Map((raw.explanations ?? []).map((e) => [e.findingId, e.text]));
  const selectedIds = new Set([...(raw.selectedFindingIds ?? []), ...mandatoryIds]);
  const selectedFindings: SearchFinding[] = candidateFindings
    .filter((f) => selectedIds.has(f.id))
    .map((f) => ({
      ...f,
      explanation: explanationById.get(f.id) ?? (f.type === "unsafe_substitution" ? String(f.detail.reason ?? "") : ""),
    }));

  // The agent's contribution ends here — an explain/recommend composition,
  // nothing more. This surface never approves a substitution or dispenses;
  // it only explains why one candidate is unsafe and recommends the
  // patient's own prescribed treatment instead (NFR-S2, FR-R6).
  assertAgentCanPerform("explain_medication");

  // Routing record only — an OTC/AYUSH item with low clinical risk
  // auto-surfaces directly to the patient with a cited why (outcome 1);
  // computed for the audit trail, not to decide whether to compose a result.
  candidateFindings.forEach((f) => {
    const salt = typeof f.detail.salt === "string" ? f.detail.salt : undefined;
    if (!salt) return;
    const decision = route({ drugSalt: salt, clinicalSeverityScore: f.type === "unsafe_substitution" ? 20 : 0 });
    console.info(`S2 routing — ${salt}: ${decision.outcome} (${decision.reason})`);
  });

  return {
    ok: true,
    result: { query, summary: raw.summary ?? "", findings: selectedFindings },
  };
}

async function runS3ProductQa(
  patientId: PatientId,
  salt: string,
  question: string
): Promise<{ ok: true; result: ProductQaResult } | { ok: false; status: number; error: string }> {
  const drug = getDrugBySalt(salt);
  if (!drug) {
    return { ok: false, status: 404, error: "Unknown product." };
  }

  const graph = getPatientGraph(patientId);
  const candidateFindings = buildProductQaCandidates(graph, salt);

  // Every real interaction/contraindication is mandatory — the model can
  // decide how to phrase and weave these in, never whether to mention them.
  const mandatoryIds = candidateFindings.map((f) => f.id);

  const userPayload = {
    instruction: "Answer the patient's question about this product.",
    question,
    product: { salt: drug.salt, brand: drug.brand, class: drug.class, legalStatus: patientLegalStatusLabel(drug.schedule), notes: drug.notes },
    patient: {
      name: graph.patient.name,
      conditions: graph.conditions.map((c) => c.name),
      currentMedications: graph.currentMedications.map((m) => `${m.brand} (${m.salt})`),
    },
    candidateFindings: candidateFindings.map((f) => ({ id: f.id, type: f.type, severity: f.severity, label: f.label, detail: f.detail })),
  };

  const callResult = await callDraftTool(S3_SYSTEM_PROMPT, userPayload, "Couldn't answer that right now.");
  if (!callResult.ok) return callResult;
  const raw = callResult.toolUse.input as DraftToolInput;

  const explanationById = new Map((raw.explanations ?? []).map((e) => [e.findingId, e.text]));
  const selectedIds = new Set([...(raw.selectedFindingIds ?? []), ...mandatoryIds]);
  const selectedFindings: QaFinding[] = candidateFindings
    .filter((f) => selectedIds.has(f.id))
    .map((f) => ({
      ...f,
      explanation: explanationById.get(f.id) ?? String(f.detail.note ?? f.detail.effect ?? ""),
    }));

  // The agent's contribution ends here — an explanation, nothing more. This
  // surface never approves, dispenses, or blocks a purchase; add-to-cart
  // stays enabled regardless of what this answer says (NFR-S2, FR-R6).
  assertAgentCanPerform("explain_medication");

  const schedule = scheduleClassify(salt) ?? "unknown";
  const maxSeverityScore = candidateFindings.reduce((max, f) => Math.max(max, scoreForKbSeverity(f.severity)), 0);
  const decision = route({ drugSalt: salt, clinicalSeverityScore: maxSeverityScore });
  console.info(`S3 routing — ${salt}: ${decision.outcome} (${decision.reason})`);

  return {
    ok: true,
    result: {
      question,
      salt,
      schedule,
      answer: raw.summary ?? "",
      findings: selectedFindings,
      routingOutcome: decision.outcome,
    },
  };
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set. Add it to .env.local (see .env.example)." },
      { status: 500 }
    );
  }

  let body: AgentRequestBody;
  try {
    body = (await request.json()) as AgentRequestBody;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  if (!body.patientId || !isValidPatientId(body.patientId)) {
    return NextResponse.json({ error: "A valid patientId is required." }, { status: 400 });
  }

  if (body.surface === "S1_prescription") {
    const result = await runS1Reconciliation(body.patientId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    // The response IS the patient-facing view for both paths: for
    // pharmacist_queue, findings is always [] here — the full clinical
    // draft lives only in the server-side queue store, read separately by
    // /pharmacist-queue, never by this call.
    return NextResponse.json(result.order);
  }

  if (body.surface === "S2_search") {
    if (!body.query || !body.query.trim()) {
      return NextResponse.json({ error: "A search query is required." }, { status: 400 });
    }
    const result = await runS2ConditionSearch(body.patientId, body.query);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    // This surface is patient-facing by design — the composed findings and
    // their explanations go straight back to whoever searched.
    return NextResponse.json(result.result);
  }

  if (body.surface === "S3_qa") {
    if (!body.query || !body.query.trim()) {
      return NextResponse.json({ error: "A question is required." }, { status: 400 });
    }
    if (!body.productSalt || !body.productSalt.trim()) {
      return NextResponse.json({ error: "A product is required." }, { status: 400 });
    }
    const result = await runS3ProductQa(body.patientId, body.productSalt, body.query);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    // This surface is patient-facing by design — the answer and its
    // findings go straight back to whoever asked; add-to-cart is never
    // touched by this route (inform, don't block).
    return NextResponse.json(result.result);
  }

  return NextResponse.json(
    {
      status: "not_implemented",
      message: "This surface isn't built yet. S1_prescription, S2_search, and S3_qa are all live.",
      tools: AGENT_TOOLS.map((t) => t.name),
    },
    { status: 501 }
  );
}
