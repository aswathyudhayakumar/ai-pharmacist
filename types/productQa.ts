/**
 * S3 graph-aware product Q&A (CLAUDE.md FR-S4). A finding's facts (severity,
 * mechanism, the drugs/conditions involved) always come straight from the
 * knowledge base and patient graph — the model only writes the direct
 * answer and the per-finding explanation (NFR-S1).
 */

import type { RoutingOutcome } from "@/lib/router";

export type QaFindingType = "interaction" | "contraindication";

export interface QaFinding {
  id: string;
  type: QaFindingType;
  /** Verbatim KB severity word (major/moderate/minor/high). */
  severity: string;
  /** Short deterministic label, e.g. "Ibuprofen × Amlodipine". */
  label: string;
  /** KB/graph record identifiers, for the "why?" trace (FR-X1). */
  sourceIds: string[];
  /** Raw KB/graph fields backing this finding — rendered verbatim, never model-authored. */
  detail: Record<string, unknown>;
  /** Model-authored 1-2 sentence plain-language gloss. */
  explanation?: string;
}

export interface ProductQaResult {
  question: string;
  salt: string;
  /** Deterministic legal schedule for this product (FR-R2). */
  schedule: string;
  /** Model-authored direct answer to the patient's question. */
  answer: string;
  findings: QaFinding[];
  /** Two-axis routing outcome for this product + patient, for the "legal says fine, clinical says caution" trace. */
  routingOutcome: RoutingOutcome;
}
