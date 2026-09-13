"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { grantConsent, revokeConsent, isValidPatientId } from "@/lib/graph";
import { ACTIVE_PATIENT_COOKIE } from "@/lib/session";
import type { PatientId } from "@/types/graph";

function requirePatientId(formData: FormData): PatientId {
  const patientId = formData.get("patientId");
  if (typeof patientId !== "string" || !isValidPatientId(patientId)) {
    throw new Error("Invalid patient id");
  }
  return patientId;
}

/** Demo-only: switches which seeded patient the current browser is viewing as. */
export async function setActivePatient(formData: FormData) {
  const patientId = requirePatientId(formData);
  const store = await cookies();
  store.set(ACTIVE_PATIENT_COOKIE, patientId, { path: "/", sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function grantConsentAction(formData: FormData) {
  const patientId = requirePatientId(formData);
  grantConsent(patientId);
  revalidatePath("/", "layout");
}

export async function revokeConsentAction(formData: FormData) {
  const patientId = requirePatientId(formData);
  revokeConsent(patientId);
  revalidatePath("/", "layout");
}
