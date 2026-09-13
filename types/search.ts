/**
 * S2 agentic search overlay (CLAUDE.md FR-S3). The app's original catalogue
 * search does the retrieval; this layer sits on top of those results. Every
 * fact here — the flags, the legal status, the price, the re-rank score, the
 * pharmacist-review alternative — is computed deterministically from the
 * knowledge base and patient graph (NFR-S1). The model only writes the
 * `summary` and the per-item / per-flag `explanation` prose, and it can never
 * remove a flag or change the order (the order is a code-computed sort over
 * `rankScore`).
 */

export type SearchFlagKind =
  | "interaction"
  | "contraindication"
  | "allergy"
  | "duplication"
  | "generic_saving";

export interface SearchFlag {
  id: string;
  kind: SearchFlagKind;
  /** Verbatim KB severity word (major/moderate/minor/high), or "info" for a generic-saving tip. */
  severity: string;
  label: string;
  /** KB/graph record identifiers, for the "why?" trace (FR-X1). */
  sourceIds: string[];
  /** Raw KB/graph fields backing this flag — rendered verbatim, never model-authored. */
  detail: Record<string, unknown>;
  /** Model-authored 1-sentence gloss. */
  explanation?: string;
}

export type SearchItemType =
  | "catalogue_result"
  | "promoted_treatment"
  | "pharmacist_review_alternative"
  | "unsafe_substitution";

export interface SearchResultItem {
  id: string;
  type: SearchItemType;
  salt: string;
  brand?: string;
  class?: string;
  /** Plain-language legal status ("No prescription needed" / "Needs a doctor's prescription") — never a schedule code. */
  legalStatus?: string;
  priceInr?: number;
  label: string;
  sourceIds: string[];
  detail: Record<string, unknown>;
  /** Per-item graph-aware flags (interactions, contraindications, allergy, duplication, generic saving). */
  flags: SearchFlag[];
  /** True when this item can't be self-served — a prescription item, or one whose clinical risk crosses the pharmacist-review threshold. */
  needsPharmacistReview: boolean;
  /** Deterministic re-rank score (higher = higher in the list). Computed in code; the model never reorders. */
  rankScore: number;
  /** Model-authored annotation for this item. */
  explanation?: string;
}

export interface ComposedSearchResult {
  query: string;
  /** Model-authored one-sentence overview of how these results were reviewed. */
  summary: string;
  /** Already re-ranked in code, most prominent first. */
  items: SearchResultItem[];
}
