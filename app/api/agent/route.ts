import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

/**
 * Tool contract for the agent orchestrator (CLAUDE.md §8). The agent calls
 * these to read the patient graph and knowledge base, classify legal
 * schedule, score clinical severity, and draft (never execute) a
 * pharmacist-facing recommendation. Execution logic lands per surface
 * (S1/S2/S3) — this route only declares the contract for now.
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
      "Produce a pharmacist-facing draft (medicines to add, best coupon, earliest delivery, or a reconciliation flag). This tool only drafts — it can never execute, dispense, approve a substitution, or change a prescription (NFR-S2, enforced in lib/router.ts, not in the prompt).",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        items: {
          type: "array",
          items: { type: "object" },
        },
        citedSources: {
          type: "array",
          items: { type: "string" },
          description: "Knowledge-base / graph facts this draft relies on, for the 'why?' trace (FR-X1).",
        },
      },
      required: ["summary"],
    },
  },
];

interface AgentRequestBody {
  patientId?: string;
  surface?: "S1_prescription" | "S2_search" | "S3_qa";
  prompt?: string;
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

  // Instantiating the client validates the key is wired up without spending a
  // call. The actual Claude round-trip (streaming, tool-use loop, guardrail
  // enforcement) is implemented per surface in S1/S2/S3, not in this scaffold.
  void new Anthropic({ apiKey });

  return NextResponse.json(
    {
      status: "not_implemented",
      message:
        "The agent orchestrator is stubbed. Tool definitions (graph_query, kb_lookup, schedule_classify, " +
        "severity_score, draft_recommendation) are wired below; the Claude round-trip and per-surface reasoning " +
        "land with S1/S2/S3.",
      received: { patientId: body.patientId ?? null, surface: body.surface ?? null },
      tools: AGENT_TOOLS.map((t) => t.name),
    },
    { status: 501 }
  );
}
