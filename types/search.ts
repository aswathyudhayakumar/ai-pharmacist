/**
 * S2 condition/symptom search composition (CLAUDE.md FR-S3). Every finding's
 * facts (schedule, class, price, the reason a substitution is unsafe) come
 * straight from the knowledge base and patient graph — the model only
 * decides which candidates to surface and writes the `explanation` prose
 * (NFR-S1: no medical fact originates from the model).
 */

export type SearchFindingType = "promoted_treatment" | "unsafe_substitution";

export interface SearchFinding {
  id: string;
  type: SearchFindingType;
  /** Short deterministic label, e.g. the brand/salt being described. */
  label: string;
  /** KB/graph record identifiers, for the "why?" trace (FR-X1). */
  sourceIds: string[];
  /** Raw KB/graph fields backing this finding — rendered verbatim, never model-authored. */
  detail: Record<string, unknown>;
  /** Model-authored 1-2 sentence plain-language gloss. */
  explanation?: string;
}

export interface ComposedSearchResult {
  query: string;
  /** Model-authored one-sentence overview. */
  summary: string;
  findings: SearchFinding[];
}
