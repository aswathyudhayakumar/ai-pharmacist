/**
 * S4 maintenance-medicine refills (repeat purchases). A medicine's
 * due/overdue status is pure day-math over its own graph fields
 * (daysSupply + lastPurchase) against a fixed demo "today" — never model
 * output (NFR-S1). The agent's only job is the re-check ("still checked
 * against your current meds") and the plain-language proposal text; it
 * never decides the due/overdue math itself, and it never adds anything to
 * the cart — that stays the patient's own tap (FR-R6).
 */

import type { QaFinding } from "@/types/productQa";

export type RefillStatus = "on_track" | "due_soon" | "overdue";

export interface RefillInfo {
  medicationId: string;
  brand: string;
  salt: string;
  strength?: string;
  status: RefillStatus;
  /** Positive = days remaining until run-out; negative = days overdue. */
  daysUntilRunOut: number;
}

/** Current brand price plus the cheapest generic equivalent right now, when one saves money. */
export interface GenericPricing {
  brandPriceInr: number;
  cheapestGenericBrand?: string;
  cheapestGenericPriceInr?: number;
  savingInr?: number;
}

export interface RefillGenericSaving {
  brand: string;
  priceInr: number;
  brandPriceInr: number;
  savingInr: number;
}

export interface RefillProposal {
  medicationId: string;
  brand: string;
  salt: string;
  status: RefillStatus;
  /** Model-authored proposal copy, grounded only in the given re-check facts. */
  message: string;
  /** Re-check findings — interactions/contraindications between this salt and the patient's other current meds, checked fresh right now (reuses the S3 finding shape and "why?" trace). */
  findings: QaFinding[];
  /** Present only when a cheaper generic exists for this salt right now. */
  genericSaving?: RefillGenericSaving;
  unitPriceInr: number;
}
