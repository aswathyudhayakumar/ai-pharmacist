"use server";

/**
 * Human-only pharmacist actions. These Server Actions are wired exclusively
 * to forms rendered on /pharmacist-queue — a real person has to click a
 * button in that UI to reach them. Nothing in app/api/agent/route.ts (the
 * agent's only code path) imports this file, so the agent has no reachable
 * route to dispatch or reject a prescription (NFR-S2, FR-R6).
 */

import { revalidatePath } from "next/cache";
import { isValidPatientId } from "@/lib/graph";
import { dispatchDraft, rejectDraft } from "@/lib/queue";

function requirePatientId(formData: FormData) {
  const patientId = formData.get("patientId");
  if (typeof patientId !== "string" || !isValidPatientId(patientId)) {
    throw new Error("Invalid patient id");
  }
  return patientId;
}

export async function dispatchDraftAction(formData: FormData) {
  const patientId = requirePatientId(formData);
  const includedSalts = formData.getAll("includeSalt").filter((v): v is string => typeof v === "string");
  dispatchDraft(patientId, includedSalts);
  revalidatePath("/pharmacist-queue");
}

export async function rejectDraftAction(formData: FormData) {
  const patientId = requirePatientId(formData);
  rejectDraft(patientId);
  revalidatePath("/pharmacist-queue");
}
