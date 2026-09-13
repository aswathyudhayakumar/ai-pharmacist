/**
 * Deterministic refill-due math for S4 (repeat purchases). Purely
 * arithmetic over each medication's own graph fields (daysSupply +
 * lastPurchase) against a fixed demo "today" — never a model decision
 * (NFR-S1). The seed data's own _comment calibrates every day-math example
 * in the spec to this exact date; the real wall-clock date would silently
 * drift the demo away from that narrative.
 */

import type { Medication, PatientGraph } from "@/types/graph";
import type { RefillInfo, RefillStatus } from "@/types/refill";

const DEMO_TODAY = new Date("2026-09-12T00:00:00Z").getTime();
const DUE_SOON_THRESHOLD_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysUntilRunOut(med: Medication): number | undefined {
  if (med.daysSupply === undefined || !med.lastPurchase) return undefined;
  const lastPurchase = new Date(`${med.lastPurchase}T00:00:00Z`).getTime();
  const runOutAt = lastPurchase + med.daysSupply * MS_PER_DAY;
  return Math.round((runOutAt - DEMO_TODAY) / MS_PER_DAY);
}

function statusFor(daysLeft: number): RefillStatus {
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= DUE_SOON_THRESHOLD_DAYS) return "due_soon";
  return "on_track";
}

export function computeRefillInfo(med: Medication): RefillInfo | undefined {
  const daysLeft = daysUntilRunOut(med);
  if (daysLeft === undefined) return undefined;
  return {
    medicationId: med.id,
    brand: med.brand,
    salt: med.salt,
    strength: med.strength,
    status: statusFor(daysLeft),
    daysUntilRunOut: daysLeft,
  };
}

/** Every current medication with computable refill math, most urgent (soonest run-out) first. */
export function computeAllRefillInfo(graph: PatientGraph): RefillInfo[] {
  return graph.currentMedications
    .map(computeRefillInfo)
    .filter((r): r is RefillInfo => r !== undefined)
    .sort((a, b) => a.daysUntilRunOut - b.daysUntilRunOut);
}

/** Fixed, code-written status line — never model-authored, so the headline fact is always trustworthy regardless of what the agent says elsewhere. */
export function refillStatusLabel(info: RefillInfo): string {
  const days = Math.abs(info.daysUntilRunOut);
  const unit = days === 1 ? "day" : "days";
  if (info.status === "overdue") {
    return `Refill overdue by ~${days} ${unit} (possible missed doses)`;
  }
  if (info.status === "due_soon") {
    return `Runs out in ~${info.daysUntilRunOut} ${unit}`;
  }
  return `On track — runs out in ~${info.daysUntilRunOut} days`;
}
