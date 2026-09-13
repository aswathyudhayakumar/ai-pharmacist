/**
 * In-memory pharmacist-queue store (prototype-scoped, like lib/graph.ts).
 * `saveDraft` is written by the agent path (app/api/agent/route.ts).
 * `dispatchDraft` and `rejectDraft` are human-only actions — they are only
 * ever called from lib/queue-actions.ts, a "use server" file wired to forms
 * on /pharmacist-queue. The agent route never imports lib/queue-actions.ts.
 */

import type { PatientId } from "@/types/graph";
import type { ReconciliationDraft } from "@/types/reconciliation";

const globalForQueue = globalThis as unknown as { __pharmacistQueueStore?: Record<string, ReconciliationDraft> };

const store: Record<string, ReconciliationDraft> = globalForQueue.__pharmacistQueueStore ?? (globalForQueue.__pharmacistQueueStore = {});

export function saveDraft(patientId: PatientId, draft: ReconciliationDraft): void {
  store[patientId] = draft;
}

export function getDraft(patientId: PatientId): ReconciliationDraft | undefined {
  const draft = store[patientId];
  return draft ? structuredClone(draft) : undefined;
}

/** Human-only: a pharmacist confirming and dispatching the drafted order. */
export function dispatchDraft(patientId: PatientId, includedSalts: string[]): ReconciliationDraft {
  const draft = store[patientId];
  if (!draft) throw new Error(`No draft for patient ${patientId}`);
  draft.status = "dispatched";
  draft.dispatchedAt = new Date().toISOString();
  draft.dispatchedSalts = includedSalts;
  return structuredClone(draft);
}

/** Human-only: a pharmacist rejecting the drafted order outright. */
export function rejectDraft(patientId: PatientId): ReconciliationDraft {
  const draft = store[patientId];
  if (!draft) throw new Error(`No draft for patient ${patientId}`);
  draft.status = "rejected";
  return structuredClone(draft);
}
