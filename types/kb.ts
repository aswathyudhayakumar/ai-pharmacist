/**
 * Typed shape of the drug knowledge base (CLAUDE.md §6). General medical
 * truth, patient-independent. The agent retrieves from this — it never
 * generates a medical fact (NFR-S1).
 */

export type Schedule = "OTC" | "AYUSH_OTC" | "H" | "H1" | "X";

export interface GenericEquivalent {
  brand: string;
  priceInr: number;
}

export interface Drug {
  salt: string;
  brand?: string;
  class: string;
  schedule: Schedule;
  otc: boolean;
  brandPriceInr: number;
  genericEquivalents: GenericEquivalent[];
  notes?: string;
}

export type InteractionSeverity = "minor" | "moderate" | "major";

export interface DrugInteraction {
  a: string;
  b: string;
  severity: InteractionSeverity;
  mechanism: string;
  effect: string;
}

export interface ClassDuplicationRule {
  class: string;
  severity: string;
  note: string;
}

export interface Contraindication {
  salt: string;
  againstCondition?: string;
  againstAllergy?: string;
  severity: string;
  note: string;
}

export interface SubstitutionTrap {
  query: string;
  trapSalt: string;
  reason: string;
  redirect: string;
}

export interface KnowledgeBase {
  drugs: Drug[];
  interactions: DrugInteraction[];
  classDuplications: ClassDuplicationRule[];
  contraindications: Contraindication[];
  substitutionTraps: SubstitutionTrap[];
  schedules: Record<Schedule, string>;
}

/** A class duplication actually found among a given set of salts. */
export interface ClassDuplicationFinding {
  class: string;
  salts: string[];
  severity: string;
  note: string;
}
