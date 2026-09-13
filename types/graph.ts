/**
 * Typed shape of the patient graph (CLAUDE.md §6). This is per-patient data
 * only — general drug facts live in the knowledge base (types/kb.ts) and are
 * overlaid onto this graph by the agent; nothing here is ever written from
 * model output (FR-G3).
 */

export type PatientId = "pat_001" | "pat_002";

export type ConsentStatus = "granted" | "not_granted";

export type GraphSource = "existing" | "abdm" | "prescription_upload" | "purchase_history" | "manual";

export interface PatientPreferences {
  genericSubstitutionOk: boolean;
  language: string;
  prefersHumanContact: boolean;
}

export interface PatientProfile {
  id: PatientId;
  name: string;
  age: number;
  city: string;
  preferences: PatientPreferences;
}

export interface Condition {
  id: string;
  name: string;
  since?: string;
  managedBy?: string;
  source?: GraphSource;
}

export interface Allergy {
  id: string;
  substance: string;
  reaction?: string;
  severity?: string;
  source?: GraphSource;
}

export interface Doctor {
  id: string;
  name: string;
  specialty?: string;
}

export interface Medication {
  id: string;
  brand: string;
  salt: string;
  strength?: string;
  forCondition?: string;
  prescribedBy?: string;
  daysSupply?: number;
  lastPurchase?: string;
  source?: GraphSource;
}

export interface Purchase {
  med: string;
  date: string;
  daysSupply: number;
}

export interface LabResult {
  id: string;
  name: string;
  value: string;
  date: string;
}

export interface PrescriptionItem {
  brand: string;
  salt: string;
  strength?: string;
}

export interface PendingPrescription {
  id: string;
  prescribedBy?: string;
  date: string;
  reason?: string;
  items: PrescriptionItem[];
}

export interface Prescription {
  id: string;
  prescribedBy?: string;
  date: string;
  items: PrescriptionItem[];
}

/** Records simulated as available from ABDM consent-import but not yet merged into the working graph (FR-C5, FR-G4). */
export interface AbdmBundle {
  conditions: Condition[];
  allergies: Allergy[];
  doctors: Doctor[];
  currentMedications: Medication[];
  prescriptions: Prescription[];
  labResults: LabResult[];
}

export interface PatientGraph {
  patient: PatientProfile;
  consentStatus: ConsentStatus;
  conditions: Condition[];
  allergies: Allergy[];
  doctors: Doctor[];
  currentMedications: Medication[];
  previousMedications: Medication[];
  purchases: Purchase[];
  labResults: LabResult[];
  pendingPrescription?: PendingPrescription;
  /** Present only while consent is not yet granted (e.g. a brand-new patient's cold start). */
  abdmAvailable?: AbdmBundle;
}
