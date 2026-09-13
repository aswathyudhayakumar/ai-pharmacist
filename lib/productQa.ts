/**
 * Deterministic fact-gathering for S3 graph-aware product Q&A. Every
 * candidate here is computed straight from the knowledge base + patient
 * graph — no model call happens in this file (NFR-S1). The agent route
 * (app/api/agent/route.ts) hands this module's output to Claude and asks it
 * only to write the direct answer and explain each finding.
 */

import { findContraindications, findInteractionsAmong } from "@/lib/kb";
import type { PatientGraph } from "@/types/graph";
import type { QaFinding } from "@/types/productQa";

/** Interactions and contraindications between this product and the patient's own graph. */
export function buildProductQaCandidates(graph: PatientGraph, salt: string): QaFinding[] {
  const currentSalts = graph.currentMedications.map((m) => m.salt);
  const comboSalts = Array.from(new Set([salt, ...currentSalts]));
  const conditionNames = graph.conditions.map((c) => c.name);
  const allergySubstances = graph.allergies.map((a) => a.substance);

  const findings: QaFinding[] = [];

  findInteractionsAmong(comboSalts)
    .filter((i) => i.a === salt || i.b === salt)
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

  findContraindications([salt], conditionNames, allergySubstances).forEach((c, idx) => {
    findings.push({
      id: `contraindication-${idx}`,
      type: "contraindication",
      severity: c.severity,
      label: `${c.salt} vs. ${c.againstCondition ?? c.againstAllergy ?? "patient history"}`,
      sourceIds: [`kb:contraindication:${c.salt}`],
      detail: { salt: c.salt, againstCondition: c.againstCondition, againstAllergy: c.againstAllergy, note: c.note },
    });
  });

  return findings;
}
