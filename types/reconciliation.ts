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
