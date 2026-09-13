import { cookies } from "next/headers";
import { DEFAULT_PATIENT_ID, isValidPatientId } from "@/lib/graph";
import type { PatientId } from "@/types/graph";

export const ACTIVE_PATIENT_COOKIE = "active_patient_id";

/** Which seeded demo patient the current browser session is viewing as. */
export async function getActivePatientId(): Promise<PatientId> {
  const store = await cookies();
  const value = store.get(ACTIVE_PATIENT_COOKIE)?.value;
  return value && isValidPatientId(value) ? value : DEFAULT_PATIENT_ID;
}
