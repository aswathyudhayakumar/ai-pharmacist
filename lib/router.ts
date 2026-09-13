/**
 * Deterministic two-axis routing engine (CLAUDE.md §7). Plain TypeScript,
 * no model calls: the legal axis is a schedule lookup and the clinical axis
 * is a fixed threshold band over a severity score the agent supplies. The
 * three routing outcomes and the gated-action guard are enforced here in
 * code, not in a prompt (NFR-S2).
 */

import { getScheduleForSalt } from "@/lib/kb";
import type { Schedule } from "@/types/kb";

export type RoutingOutcome = "auto_surface" | "pharmacist_queue" | "live_call";

export type ClinicalBand = "low" | "high" | "very_high_ambiguity";

/** Deterministic legal-schedule lookup (FR-R2) — a KB lookup, never a model decision. */
export function scheduleClassify(salt: string): Schedule | undefined {
  return getScheduleForSalt(salt);
}

const RX_SCHEDULES: ReadonlySet<Schedule> = new Set(["H", "H1", "X"]);

/** Structured clinical-severity score band, per the fixed thresholds in CLAUDE.md §7. */
export const SEVERITY_THRESHOLDS = {
  /** score >= this crosses into pharmacist-queue territory even for OTC (FR-R4). */
  queue: 40,
  /** score >= this is "very high ambiguity" — system-escalated to a live call (FR-R7). */
  liveCall: 80,
} as const;

export function bandSeverity(score: number): ClinicalBand {
  if (score >= SEVERITY_THRESHOLDS.liveCall) return "very_high_ambiguity";
  if (score >= SEVERITY_THRESHOLDS.queue) return "high";
  return "low";
}

export interface RouteRequest {
  /** Drug salt to classify legally. Omit for a purely clinical finding not tied to one drug (e.g. a duplication across two salts — pass either). */
  drugSalt?: string;
  /** 0-100 structured severity score, produced by the severity_score tool. */
  clinicalSeverityScore: number;
  /** The patient can always reach a human directly, regardless of classification (FR-R7). */
  patientRequestedLiveCall?: boolean;
}

export interface RouteResult {
  outcome: RoutingOutcome;
  legalSchedule: Schedule | "not_applicable";
  legalGateTripped: boolean;
  clinicalBand: ClinicalBand;
  clinicalGateTripped: boolean;
  reason: string;
}

export function route(req: RouteRequest): RouteResult {
  const legalSchedule = req.drugSalt ? scheduleClassify(req.drugSalt) ?? "not_applicable" : "not_applicable";
  const legalGateTripped = legalSchedule !== "not_applicable" && RX_SCHEDULES.has(legalSchedule);
  const clinicalBand = bandSeverity(req.clinicalSeverityScore);
  const clinicalGateTripped = clinicalBand !== "low";

  if (req.patientRequestedLiveCall) {
    return {
      outcome: "live_call",
      legalSchedule,
      legalGateTripped,
      clinicalBand,
      clinicalGateTripped,
      reason: "Patient asked to talk to a live pharmacist.",
    };
  }

  if (clinicalBand === "very_high_ambiguity") {
    return {
      outcome: "live_call",
      legalSchedule,
      legalGateTripped,
      clinicalBand,
      clinicalGateTripped,
      reason: "Clinical severity score is very high / ambiguous — escalated to a live pharmacist call.",
    };
  }

  if (legalGateTripped) {
    return {
      outcome: "pharmacist_queue",
      legalSchedule,
      legalGateTripped,
      clinicalBand,
      clinicalGateTripped,
      reason: `Schedule ${legalSchedule} requires pharmacist verification before dispatch.`,
    };
  }

  if (clinicalBand === "high") {
    return {
      outcome: "pharmacist_queue",
      legalSchedule,
      legalGateTripped,
      clinicalBand,
      clinicalGateTripped,
      reason: "Clinical severity crossed the pharmacist-review threshold, even though the item is OTC.",
    };
  }

  return {
    outcome: "auto_surface",
    legalSchedule,
    legalGateTripped,
    clinicalBand,
    clinicalGateTripped,
    reason: "OTC / non-scheduled item with low clinical risk — surfaced to the patient with a cited why.",
  };
}

// --- Hard guard: gated actions can never auto-execute (NFR-S2) -------------
// Mirrors the permissions matrix in CLAUDE.md §7. Enforced here in code so
// no prompt-level instruction is the only thing standing between the agent
// and a gated action.

export type AgentAction =
  | "explain_medication"
  | "remind_patient"
  | "detect_interaction"
  | "reconcile_medication_list"
  | "identify_refill_gap"
  | "draft_recommendation"
  | "recommend_generic_alternative"
  | "approve_substitution"
  | "change_prescription"
  | "prescribe"
  | "dispense_prescription_drugs";

const AGENT_PERMITTED_ACTIONS: ReadonlySet<AgentAction> = new Set([
  "explain_medication",
  "remind_patient",
  "detect_interaction",
  "reconcile_medication_list",
  "identify_refill_gap",
  "draft_recommendation",
  "recommend_generic_alternative",
]);

export class GatedActionError extends Error {
  constructor(action: AgentAction) {
    super(`"${action}" is a gated action — the agent may draft it but a human must execute it.`);
    this.name = "GatedActionError";
  }
}

/** Throws if the agent attempts a gated action. Call this at the point of execution, not just when drafting. */
export function assertAgentCanPerform(action: AgentAction): void {
  if (!AGENT_PERMITTED_ACTIONS.has(action)) {
    throw new GatedActionError(action);
  }
}

export function isGatedAction(action: AgentAction): boolean {
  return !AGENT_PERMITTED_ACTIONS.has(action);
}
