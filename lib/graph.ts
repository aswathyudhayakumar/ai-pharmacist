import patientGraphP2Raw from "@/data/patient_graph.json";
import patientGraphP1Raw from "@/data/patient_graph_p1.json";
import type {
  AbdmBundle,
  Allergy,
  Condition,
  ConsentStatus,
  Doctor,
  LabResult,
  Medication,
  PatientGraph,
  PatientId,
  PatientProfile,
  PendingPrescription,
  Prescription,
  PrescriptionItem,
  Purchase,
} from "@/types/graph";

// --- Raw JSON shapes (snake_case, as seeded in /data) -----------------------

interface RawPatient {
  id: string;
  name: string;
  age: number;
  city: string;
  preferences: {
    generic_substitution_ok: boolean;
    language: string;
    prefers_human_contact: boolean;
  };
}

interface RawCondition {
  id: string;
  name: string;
  since?: string;
  managed_by?: string;
}

interface RawAllergy {
  id: string;
  substance: string;
  reaction?: string;
  severity?: string;
}

interface RawDoctor {
  id: string;
  name: string;
  specialty?: string;
}

interface RawMedication {
  id: string;
  brand: string;
  salt: string;
  strength?: string;
  for_condition?: string;
  prescribed_by?: string;
  days_supply?: number;
  last_purchase?: string;
}

interface RawPurchase {
  med: string;
  date: string;
  days_supply: number;
}

interface RawLabResult {
  id: string;
  name: string;
  value: string;
  date: string;
}

interface RawPrescriptionItem {
  brand: string;
  salt: string;
  strength?: string;
}

interface RawPendingPrescription {
  id: string;
  prescribed_by?: string;
  date: string;
  reason?: string;
  items: RawPrescriptionItem[];
}

interface RawPrescription {
  id: string;
  prescribed_by?: string;
  date: string;
  items: RawPrescriptionItem[];
}

interface RawGraphP2 {
  patient: RawPatient;
  conditions: RawCondition[];
  allergies: RawAllergy[];
  doctors: RawDoctor[];
  current_medications: RawMedication[];
  previous_medications: RawMedication[];
  purchases: RawPurchase[];
  lab_results: RawLabResult[];
  pending_prescription?: RawPendingPrescription;
}

interface RawGraphP1 {
  patient: RawPatient;
  consent_status: string;
  pre_consent: {
    conditions: RawCondition[];
    allergies: RawAllergy[];
    current_medications: RawMedication[];
    purchases: RawPurchase[];
    lab_results: RawLabResult[];
  };
  abdm_available: {
    conditions: RawCondition[];
    allergies: RawAllergy[];
    doctors: RawDoctor[];
    current_medications: RawMedication[];
    prescriptions: RawPrescription[];
    lab_results: RawLabResult[];
  };
}

// --- Mappers: snake_case JSON -> camelCase typed domain objects ------------

function mapPatient(raw: RawPatient): PatientProfile {
  return {
    id: raw.id as PatientId,
    name: raw.name,
    age: raw.age,
    city: raw.city,
    preferences: {
      genericSubstitutionOk: raw.preferences.generic_substitution_ok,
      language: raw.preferences.language,
      prefersHumanContact: raw.preferences.prefers_human_contact,
    },
  };
}

function mapCondition(raw: RawCondition, source: Condition["source"]): Condition {
  return { id: raw.id, name: raw.name, since: raw.since, managedBy: raw.managed_by, source };
}

function mapAllergy(raw: RawAllergy, source: Allergy["source"]): Allergy {
  return { id: raw.id, substance: raw.substance, reaction: raw.reaction, severity: raw.severity, source };
}

function mapDoctor(raw: RawDoctor): Doctor {
  return { id: raw.id, name: raw.name, specialty: raw.specialty };
}

function mapMedication(raw: RawMedication, source: Medication["source"]): Medication {
  return {
    id: raw.id,
    brand: raw.brand,
    salt: raw.salt,
    strength: raw.strength,
    forCondition: raw.for_condition,
    prescribedBy: raw.prescribed_by,
    daysSupply: raw.days_supply,
    lastPurchase: raw.last_purchase,
    source,
  };
}

function mapPurchase(raw: RawPurchase): Purchase {
  return { med: raw.med, date: raw.date, daysSupply: raw.days_supply };
}

function mapLabResult(raw: RawLabResult): LabResult {
  return { id: raw.id, name: raw.name, value: raw.value, date: raw.date };
}

function mapPrescriptionItem(raw: RawPrescriptionItem): PrescriptionItem {
  return { brand: raw.brand, salt: raw.salt, strength: raw.strength };
}

function mapPendingPrescription(raw: RawPendingPrescription): PendingPrescription {
  return {
    id: raw.id,
    prescribedBy: raw.prescribed_by,
    date: raw.date,
    reason: raw.reason,
    items: raw.items.map(mapPrescriptionItem),
  };
}

function mapPrescription(raw: RawPrescription): Prescription {
  return {
    id: raw.id,
    prescribedBy: raw.prescribed_by,
    date: raw.date,
    items: raw.items.map(mapPrescriptionItem),
  };
}

function mapAbdmBundle(raw: RawGraphP1["abdm_available"]): AbdmBundle {
  return {
    conditions: raw.conditions.map((c) => mapCondition(c, "abdm")),
    allergies: raw.allergies.map((a) => mapAllergy(a, "abdm")),
    doctors: raw.doctors.map(mapDoctor),
    currentMedications: raw.current_medications.map((m) => mapMedication(m, "abdm")),
    prescriptions: raw.prescriptions.map(mapPrescription),
    labResults: raw.lab_results.map(mapLabResult),
  };
}

// --- Build the initial in-memory store --------------------------------------
// Prototype-scoped: a module-level store stands in for the "structured store"
// described in CLAUDE.md §6. P2 loads already populated (an existing user);
// P1 starts from her empty pre_consent state and only gains her ABDM records
// once grantConsent() is called — the cold-start -> consent -> populate arc.

function buildP2(): PatientGraph {
  const raw = patientGraphP2Raw as unknown as RawGraphP2;
  return {
    patient: mapPatient(raw.patient),
    consentStatus: "granted",
    conditions: raw.conditions.map((c) => mapCondition(c, "existing")),
    allergies: raw.allergies.map((a) => mapAllergy(a, "existing")),
    doctors: raw.doctors.map(mapDoctor),
    currentMedications: raw.current_medications.map((m) => mapMedication(m, "existing")),
    previousMedications: raw.previous_medications.map((m) => mapMedication(m, "existing")),
    purchases: raw.purchases.map(mapPurchase),
    labResults: raw.lab_results.map(mapLabResult),
    pendingPrescription: raw.pending_prescription ? mapPendingPrescription(raw.pending_prescription) : undefined,
  };
}

function buildP1(): PatientGraph {
  const raw = patientGraphP1Raw as unknown as RawGraphP1;
  return {
    patient: mapPatient(raw.patient),
    consentStatus: raw.consent_status as ConsentStatus,
    conditions: raw.pre_consent.conditions.map((c) => mapCondition(c, "existing")),
    allergies: raw.pre_consent.allergies.map((a) => mapAllergy(a, "existing")),
    doctors: [],
    currentMedications: raw.pre_consent.current_medications.map((m) => mapMedication(m, "existing")),
    previousMedications: [],
    purchases: raw.pre_consent.purchases.map(mapPurchase),
    labResults: raw.pre_consent.lab_results.map(mapLabResult),
    pendingPrescription: undefined,
    abdmAvailable: mapAbdmBundle(raw.abdm_available),
  };
}

export const DEFAULT_PATIENT_ID: PatientId = "pat_001";
export const PATIENT_IDS: readonly PatientId[] = ["pat_001", "pat_002"];

// Guard against Next.js dev-server hot-reload re-running this module and
// resetting demo state on every edit.
const globalForGraph = globalThis as unknown as { __patientGraphStore?: Record<PatientId, PatientGraph> };

const store: Record<PatientId, PatientGraph> =
  globalForGraph.__patientGraphStore ??
  (globalForGraph.__patientGraphStore = {
    pat_001: buildP2(),
    pat_002: buildP1(),
  });

export function isValidPatientId(id: string): id is PatientId {
  return id === "pat_001" || id === "pat_002";
}

export function listPatients(): PatientProfile[] {
  return PATIENT_IDS.map((id) => store[id].patient);
}

/** Returns a snapshot of the patient's working graph. The agent overlays the knowledge base onto this; it never writes facts back into it. */
export function getPatientGraph(id: PatientId): PatientGraph {
  const graph = store[id];
  if (!graph) throw new Error(`Unknown patient id: ${id}`);
  return structuredClone(graph);
}

/**
 * Merges the patient's simulated ABDM records into their working graph and
 * marks consent granted (FR-C1, FR-C5, FR-G4). No-ops the merge (but still
 * marks granted) for a patient with no ABDM bundle pending.
 */
export function grantConsent(id: PatientId): PatientGraph {
  const graph = store[id];
  if (!graph) throw new Error(`Unknown patient id: ${id}`);

  if (graph.abdmAvailable) {
    const bundle = graph.abdmAvailable;
    graph.conditions = [...graph.conditions, ...bundle.conditions];
    graph.allergies = [...graph.allergies, ...bundle.allergies];
    graph.doctors = [...graph.doctors, ...bundle.doctors];
    graph.currentMedications = [...graph.currentMedications, ...bundle.currentMedications];
    graph.labResults = [...graph.labResults, ...bundle.labResults];
    graph.abdmAvailable = undefined;
  }
  graph.consentStatus = "granted";
  return structuredClone(graph);
}

/**
 * Revokes consent (FR-C3): pulls ABDM-sourced records back out of the working
 * graph. Manually-entered or prescription-sourced data is left alone. A
 * prototype stand-in for the real retention/erasure policy.
 */
export function revokeConsent(id: PatientId): PatientGraph {
  const graph = store[id];
  if (!graph) throw new Error(`Unknown patient id: ${id}`);

  const abdmConditions = graph.conditions.filter((c) => c.source === "abdm");
  const abdmAllergies = graph.allergies.filter((a) => a.source === "abdm");
  const abdmMedications = graph.currentMedications.filter((m) => m.source === "abdm");

  if (abdmConditions.length || abdmAllergies.length || abdmMedications.length) {
    graph.abdmAvailable = {
      conditions: abdmConditions,
      allergies: abdmAllergies,
      doctors: graph.doctors,
      currentMedications: abdmMedications,
      prescriptions: [],
      labResults: graph.labResults,
    };
    graph.conditions = graph.conditions.filter((c) => c.source !== "abdm");
    graph.allergies = graph.allergies.filter((a) => a.source !== "abdm");
    graph.currentMedications = graph.currentMedications.filter((m) => m.source !== "abdm");
    graph.doctors = [];
    graph.labResults = [];
  }
  graph.consentStatus = "not_granted";
  return structuredClone(graph);
}

export function getCurrentSalts(id: PatientId): string[] {
  return store[id].currentMedications.map((m) => m.salt);
}

export function getConditionNames(id: PatientId): string[] {
  return store[id].conditions.map((c) => c.name);
}

export function getAllergySubstances(id: PatientId): string[] {
  return store[id].allergies.map((a) => a.substance);
}
