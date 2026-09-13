/**
 * Deterministic fact-gathering for S2 condition/symptom search composition.
 * Every candidate here is computed straight from the knowledge base +
 * patient graph — no model call happens in this file (NFR-S1). The agent
 * route (app/api/agent/route.ts) hands this module's output to Claude and
 * asks it only to select which candidates to surface and explain them.
 */

import { findSubstitutionTrap, getDrugBySalt, patientLegalStatusLabel } from "@/lib/kb";
import type { PatientGraph } from "@/types/graph";
import type { SearchFinding } from "@/types/search";

/**
 * Builds the candidate results for a condition/symptom search. Returns an
 * empty array when the query doesn't match a known substitution trap — the
 * caller falls back to the plain catalogue search for those queries.
 */
export function buildSearchCandidates(graph: PatientGraph, query: string): SearchFinding[] {
  const trap = findSubstitutionTrap(query);
  if (!trap) return [];

  const findings: SearchFinding[] = [];

  // Personalize only when the patient actually has this treatment on file —
  // never fabricate a promoted result for a patient who doesn't (graceful
  // degradation for patients other than the one this trap was seeded for).
  if (trap.redirectSalt) {
    const patientMed = graph.currentMedications.find((m) => m.salt === trap.redirectSalt);
    const redirectDrug = getDrugBySalt(trap.redirectSalt);
    if (patientMed && redirectDrug) {
      const condition = graph.conditions.find((c) => c.id === patientMed.forCondition);
      findings.push({
        id: "promoted-0",
        type: "promoted_treatment",
        label: `${patientMed.brand} (${patientMed.salt})`,
        sourceIds: [`graph:medication:${patientMed.id}`, `kb:drug:${redirectDrug.salt}`],
        detail: {
          brand: patientMed.brand,
          salt: patientMed.salt,
          class: redirectDrug.class,
          legalStatus: patientLegalStatusLabel(redirectDrug.schedule),
          brandPriceInr: redirectDrug.brandPriceInr,
          prescribedFor: condition?.name,
        },
      });
    }
  }

  const trapDrug = getDrugBySalt(trap.trapSalt);
  findings.push({
    id: "flag-0",
    type: "unsafe_substitution",
    label: trapDrug?.brand ?? trap.trapSalt,
    sourceIds: [`kb:substitution_trap:${trap.query}`, `kb:drug:${trap.trapSalt}`],
    detail: {
      salt: trap.trapSalt,
      brand: trapDrug?.brand,
      class: trapDrug?.class,
      legalStatus: trapDrug ? patientLegalStatusLabel(trapDrug.schedule) : undefined,
      brandPriceInr: trapDrug?.brandPriceInr,
      reason: trap.reason,
      notes: trapDrug?.notes,
    },
  });

  return findings;
}
