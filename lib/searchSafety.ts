/**
 * Deterministic overlay for S2 agentic search. The app's original catalogue
 * search (lib/kb.ts `catalogueSearch`) does the retrieval; this module takes
 * that result set and, purely from the knowledge base + patient graph,
 * computes the graph-aware flags, the special findings (the patient's own
 * prescribed treatment, a pharmacist-review alternative, an unsafe
 * substitution), and a re-rank score for each — no model call happens here
 * (NFR-S1). The agent route (app/api/agent/route.ts) hands this output to
 * Claude only to write the summary and the per-item / per-flag prose, then
 * sorts by rankScore in code. The model can never drop a flag or reorder.
 */

import {
  catalogueSearch,
  findClassDuplicationsAmong,
  findContraindications,
  findInteractionsAmong,
  findSubstitutionTrap,
  getDrugBySalt,
  patientLegalStatusLabel,
  priceWithCheapestGeneric,
} from "@/lib/kb";
import { isRxSchedule, scoreForKbSeverity, SEVERITY_THRESHOLDS } from "@/lib/router";
import type { PatientGraph } from "@/types/graph";
import type { Drug } from "@/types/kb";
import type { SearchFlag, SearchResultItem } from "@/types/search";

// Re-rank tiers (higher = more prominent). The patient's own prescribed
// treatment leads; a gated alternative sits just under it; plain catalogue
// results occupy the middle, sinking as their clinical risk rises; an unsafe
// substitution is pushed low but stays visible and flagged (FR-S3).
const RANK = { promoted: 1000, alternative: 900, catalogue: 500, unsafe: 150 } as const;

/** All graph-aware flags for one salt against the patient's own graph — the same deterministic checks used across S1/S3/S4. */
function flagsForSalt(graph: PatientGraph, salt: string, itemId: string): SearchFlag[] {
  const currentSalts = graph.currentMedications.map((m) => m.salt);
  const comboSalts = Array.from(new Set([salt, ...currentSalts]));
  const conditionNames = graph.conditions.map((c) => c.name);
  const allergySubstances = graph.allergies.map((a) => a.substance);

  const flags: SearchFlag[] = [];

  findInteractionsAmong(comboSalts)
    .filter((i) => i.a === salt || i.b === salt)
    .forEach((i, idx) => {
      flags.push({
        id: `${itemId}#interaction-${idx}`,
        kind: "interaction",
        severity: i.severity,
        label: `${i.a} × ${i.b}`,
        sourceIds: [`kb:interaction:${i.a}:${i.b}`],
        detail: { a: i.a, b: i.b, mechanism: i.mechanism, effect: i.effect },
      });
    });

  findContraindications([salt], conditionNames, allergySubstances).forEach((c, idx) => {
    flags.push({
      id: `${itemId}#contra-${idx}`,
      kind: c.againstAllergy ? "allergy" : "contraindication",
      severity: c.severity,
      label: `${c.salt} vs. ${c.againstCondition ?? c.againstAllergy ?? "patient history"}`,
      sourceIds: [`kb:contraindication:${c.salt}`],
      detail: { salt: c.salt, againstCondition: c.againstCondition, againstAllergy: c.againstAllergy, note: c.note },
    });
  });

  findClassDuplicationsAmong(comboSalts)
    .filter((d) => d.salts.includes(salt))
    .forEach((d, idx) => {
      flags.push({
        id: `${itemId}#dup-${idx}`,
        kind: "duplication",
        severity: d.severity,
        label: `${d.class}: ${d.salts.join(" + ")}`,
        sourceIds: [`kb:class_duplication:${d.class}`],
        detail: { class: d.class, salts: d.salts, note: d.note },
      });
    });

  const pricing = priceWithCheapestGeneric(salt);
  if (pricing?.cheapestGenericBrand && pricing.savingInr) {
    flags.push({
      id: `${itemId}#generic`,
      kind: "generic_saving",
      severity: "info",
      label: `Cheaper generic — saves ₹${pricing.savingInr}`,
      sourceIds: [`kb:generic:${salt}`],
      detail: { brand: pricing.cheapestGenericBrand, genericPriceInr: pricing.cheapestGenericPriceInr, brandPriceInr: pricing.brandPriceInr, savingInr: pricing.savingInr },
    });
  }

  return flags;
}

function maxSeverityScore(flags: SearchFlag[]): number {
  return flags.reduce((max, f) => Math.max(max, scoreForKbSeverity(f.severity)), 0);
}

function catalogueItem(graph: PatientGraph, drug: Drug): SearchResultItem {
  const id = `item:${drug.salt}`;
  const flags = flagsForSalt(graph, drug.salt, id);
  const rx = isRxSchedule(drug.schedule);
  const sev = maxSeverityScore(flags);
  return {
    id,
    type: "catalogue_result",
    salt: drug.salt,
    brand: drug.brand,
    class: drug.class,
    legalStatus: patientLegalStatusLabel(drug.schedule),
    priceInr: drug.brandPriceInr,
    label: drug.brand ?? drug.salt,
    sourceIds: [`kb:drug:${drug.salt}`],
    detail: { salt: drug.salt, class: drug.class, notes: drug.notes },
    flags,
    needsPharmacistReview: rx || sev >= SEVERITY_THRESHOLDS.queue,
    rankScore: RANK.catalogue - sev,
  };
}

/**
 * Builds the full overlay for a query: the special findings from a matched
 * substitution trap (promoted treatment, pharmacist-review alternative,
 * unsafe substitution) plus every plain catalogue result, each annotated with
 * its graph-aware flags and a re-rank score. Deterministic end to end.
 */
export function buildSearchOverlay(graph: PatientGraph, query: string): SearchResultItem[] {
  const items: SearchResultItem[] = [];
  const claimedSalts = new Set<string>();

  const trap = findSubstitutionTrap(query);
  if (trap) {
    // The patient's own prescribed treatment for this condition — shown only
    // when they actually have it on file (never fabricated for someone else).
    let patientHasTreatment = false;
    if (trap.redirectSalt) {
      const patientMed = graph.currentMedications.find((m) => m.salt === trap.redirectSalt);
      const redirectDrug = getDrugBySalt(trap.redirectSalt);
      if (patientMed && redirectDrug) {
        patientHasTreatment = true;
        claimedSalts.add(redirectDrug.salt);
        const condition = graph.conditions.find((c) => c.id === patientMed.forCondition);
        items.push({
          id: `promoted:${redirectDrug.salt}`,
          type: "promoted_treatment",
          salt: redirectDrug.salt,
          brand: patientMed.brand,
          class: redirectDrug.class,
          legalStatus: patientLegalStatusLabel(redirectDrug.schedule),
          priceInr: redirectDrug.brandPriceInr,
          label: `${patientMed.brand} (${patientMed.salt})`,
          sourceIds: [`graph:medication:${patientMed.id}`, `kb:drug:${redirectDrug.salt}`],
          detail: { brand: patientMed.brand, salt: patientMed.salt, class: redirectDrug.class, prescribedFor: condition?.name },
          flags: [],
          needsPharmacistReview: false,
          rankScore: RANK.promoted,
        });
      }
    }

    // A curated prescription alternative that could fit the same condition —
    // surfaced only for a patient who already has this condition's treatment
    // on file, and always gated to pharmacist review (it never self-serves).
    if (patientHasTreatment && trap.pharmacistReviewAlternative) {
      const altDrug = getDrugBySalt(trap.pharmacistReviewAlternative.salt);
      if (altDrug) {
        claimedSalts.add(altDrug.salt);
        const id = `alt:${altDrug.salt}`;
        const flags = flagsForSalt(graph, altDrug.salt, id);
        items.push({
          id,
          type: "pharmacist_review_alternative",
          salt: altDrug.salt,
          brand: altDrug.brand,
          class: altDrug.class,
          legalStatus: patientLegalStatusLabel(altDrug.schedule),
          priceInr: altDrug.brandPriceInr,
          label: altDrug.brand ?? altDrug.salt,
          sourceIds: [`kb:drug:${altDrug.salt}`, `kb:substitution_trap:${trap.query}`],
          detail: { salt: altDrug.salt, class: altDrug.class, reason: trap.pharmacistReviewAlternative.reason },
          flags,
          needsPharmacistReview: true,
          rankScore: RANK.alternative,
        });
      }
    }

    // The unsafe substitution is always shown (safety), flagged, and sunk.
    const trapDrug = getDrugBySalt(trap.trapSalt);
    claimedSalts.add(trap.trapSalt);
    items.push({
      id: `trap:${trap.trapSalt}`,
      type: "unsafe_substitution",
      salt: trap.trapSalt,
      brand: trapDrug?.brand,
      class: trapDrug?.class,
      legalStatus: trapDrug ? patientLegalStatusLabel(trapDrug.schedule) : undefined,
      priceInr: trapDrug?.brandPriceInr,
      label: trapDrug?.brand ?? trap.trapSalt,
      sourceIds: [`kb:substitution_trap:${trap.query}`, `kb:drug:${trap.trapSalt}`],
      detail: { salt: trap.trapSalt, brand: trapDrug?.brand, class: trapDrug?.class, reason: trap.reason, notes: trapDrug?.notes },
      flags: [],
      needsPharmacistReview: false,
      rankScore: RANK.unsafe,
    });
  }

  // Every plain catalogue result the app's own search returned, annotated —
  // skipping any salt already represented as a special finding above.
  for (const drug of catalogueSearch(query)) {
    if (claimedSalts.has(drug.salt)) continue;
    items.push(catalogueItem(graph, drug));
  }

  return items;
}
