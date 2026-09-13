/**
 * Deterministic fact-gathering for S1 prescription reconciliation. Every
 * finding here is computed straight from the knowledge base + patient
 * graph — no model call happens in this file (NFR-S1). The agent route
 * (app/api/agent/route.ts) hands the output of this module to Claude and
 * asks it only to select which findings matter and explain them in prose.
 */

import { findClassDuplicationsAmong, findContraindications, findInteractionsAmong, getCheaperGenerics, getDrugBySalt } from "@/lib/kb";
import type { PatientGraph } from "@/types/graph";
import type { ReconciliationFinding } from "@/types/reconciliation";

export function buildCandidateFindings(graph: PatientGraph): ReconciliationFinding[] {
  const rx = graph.pendingPrescription;
  if (!rx) return [];

  const candidateSalts = rx.items.map((i) => i.salt);
  const currentSalts = graph.currentMedications.map((m) => m.salt);
  const comboSalts = Array.from(new Set([...candidateSalts, ...currentSalts]));
  const conditionNames = graph.conditions.map((c) => c.name);
  const allergySubstances = graph.allergies.map((a) => a.substance);

  const findings: ReconciliationFinding[] = [];

  findInteractionsAmong(comboSalts)
    .filter((i) => candidateSalts.includes(i.a) || candidateSalts.includes(i.b))
    .forEach((i, idx) => {
      findings.push({
        id: `interaction-${idx}`,
        type: "interaction",
        severity: i.severity,
        label: `${i.a} × ${i.b}`,
        sourceIds: [`kb:interaction:${i.a}:${i.b}`],
        detail: { a: i.a, b: i.b, mechanism: i.mechanism, effect: i.effect },
      });
    });

  findClassDuplicationsAmong(comboSalts)
    .filter((d) => d.salts.some((s) => candidateSalts.includes(s)))
    .forEach((d, idx) => {
      findings.push({
        id: `duplication-${idx}`,
        type: "duplication",
        severity: d.severity,
        label: `${d.class}: ${d.salts.join(" + ")}`,
        sourceIds: [`kb:class_duplication:${d.class}`],
        detail: { class: d.class, salts: d.salts, note: d.note },
      });
    });

  findContraindications(candidateSalts, conditionNames, allergySubstances).forEach((c, idx) => {
    findings.push({
      id: `contraindication-${idx}`,
      type: "contraindication",
      severity: c.severity,
      label: `${c.salt} vs. ${c.againstCondition ?? c.againstAllergy ?? "patient history"}`,
      sourceIds: [`kb:contraindication:${c.salt}`],
      detail: { salt: c.salt, againstCondition: c.againstCondition, againstAllergy: c.againstAllergy, note: c.note },
    });
  });

  candidateSalts.forEach((salt, idx) => {
    const drug = getDrugBySalt(salt);
    const generics = getCheaperGenerics(salt);
    if (!drug || generics.length === 0) return;
    const cheapest = generics.reduce((a, b) => (a.priceInr < b.priceInr ? a : b));
    if (cheapest.priceInr >= drug.brandPriceInr) return;
    findings.push({
      id: `generic-${idx}`,
      type: "generic_saving",
      severity: "info",
      label: `${salt}: ${cheapest.brand} vs. brand`,
      sourceIds: [`kb:generic:${salt}`],
      detail: { salt, brandPriceInr: drug.brandPriceInr, genericBrand: cheapest.brand, genericPriceInr: cheapest.priceInr },
    });
  });

  return findings;
}

/** Whether a candidate finding involves the given salt — used to attribute a KB-sourced severity to each item for routing. */
export function findingReferencesSalt(finding: ReconciliationFinding, salt: string): boolean {
  switch (finding.type) {
    case "interaction":
      return finding.detail.a === salt || finding.detail.b === salt;
    case "duplication":
      return Array.isArray(finding.detail.salts) && (finding.detail.salts as string[]).includes(salt);
    case "contraindication":
    case "generic_saving":
      return finding.detail.salt === salt;
    default:
      return false;
  }
}

/**
 * Maps a KB severity word to a numeric band for the deterministic router
 * (lib/router.ts). The word itself is always KB-sourced; this mapping is
 * just the router's own scale, analogous to schedule -> legal-gate boolean.
 * Kept below the router's live-call threshold (80) so a single major
 * finding queues for pharmacist review rather than escalating to a call.
 */
const SEVERITY_TO_SCORE: Record<string, number> = {
  major: 70,
  high: 70,
  moderate: 50,
  minor: 20,
  info: 5,
};

export function severityScoreForSalt(findings: ReconciliationFinding[], salt: string): number {
  const relevant = findings.filter((f) => findingReferencesSalt(f, salt));
  return relevant.reduce((max, f) => Math.max(max, SEVERITY_TO_SCORE[f.severity.toLowerCase()] ?? 0), 0);
}
