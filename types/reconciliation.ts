/**
 * S1 prescription reconciliation (CLAUDE.md FR-S1/FR-S2). A finding's
 * `severity` is always copied verbatim from the knowledge base — the model
 * only supplies which findings are worth surfacing and the plain-language
 * `explanation` (NFR-S1: no medical fact originates from the model).
 */

export type FindingType = "interaction" | "duplication" | "contraindication" | "generic_saving";

export interface ReconciliationFinding {
  id: string;
  type: FindingType;
  /** Verbatim KB severity word (major/moderate/minor/high), or "info" for a generic-saving tip (not a clinical severity). */
  severity: string;
  /** Short deterministic label, e.g. "Clarithromycin × Atorvastatin". */
  label: string;
  /** KB record identifiers, for the "why?" trace (FR-X1). */
  sourceIds: string[];
  /** Raw KB fields backing this finding — rendered verbatim, never model-authored. */
  detail: Record<string, unknown>;
  /** Model-authored 1-2 sentence plain-language gloss, filled in only for findings the model selected. */
  explanation?: string;
}

export interface PharmacistSelections {
  /** Salts from the pending prescription to add to the order. */
  medsToAdd: string[];
  bestCoupon?: string;
  earliestDelivery?: string;
}

export type DraftStatus = "awaiting_pharmacist" | "dispatched" | "rejected";

export interface ReconciliationDraft {
  patientId: string;
  prescriptionId: string;
  createdAt: string;
  /** Model-authored one-sentence overview. */
  summary: string;
  findings: ReconciliationFinding[];
  pharmacistSelections: PharmacistSelections;
  legalSchedules: { salt: string; schedule: string }[];
  status: DraftStatus;
  dispatchedAt?: string;
  dispatchedSalts?: string[];
}

/**
 * The prescription-upload split (CLAUDE.md FR-S1/FR-S2): the legal axis
 * (drug schedule) deterministically decides which path an uploaded
 * prescription takes. "auto_ready" (all items non-scheduled) means the
 * agent has already prepared a one-tap order for the patient to pay
 * themselves — nothing is legally gated. "pharmacist_queue" (any item is
 * Schedule H/H1/X) means the same prep happened, but the order needs a
 * licensed pharmacist's approval before dispatch — full ReconciliationDraft
 * (clinical findings included) is what the pharmacist sees; this lighter
 * PreparedOrder is what the patient sees, and clinical flags never appear
 * in it for that path.
 */
export type RxRoutingOutcome = "auto_ready" | "pharmacist_queue";

export interface PricedItem {
  salt: string;
  brand: string;
  strength?: string;
  unitPriceInr: number;
  /** Plain-language savings note when a cheaper generic was applied — not a clinical fact, safe to show on both paths. */
  genericSavingNote?: string;
}

export interface PreparedOrder {
  prescriptionId: string;
  routingOutcome: RxRoutingOutcome;
  /** Patient-facing summary. For pharmacist_queue this is a fixed, deterministic line — never the model's pharmacist-audience text. */
  summary: string;
  items: PricedItem[];
  totalInr: number;
  /** auto_ready only. */
  coupon?: string;
  /** auto_ready only. */
  earliestDelivery?: string;
  /** Populated only for auto_ready — pharmacist_queue never sends clinical findings to the patient (FR-R6). */
  findings: ReconciliationFinding[];
  /** pharmacist_queue only: a fixed, code-written, jargon-free legal notice — never model-authored, so it can never leak a schedule code. */
  legalNote?: string;
}
