import Link from "next/link";
import { getActivePatientId } from "@/lib/session";
import { getPatientGraph } from "@/lib/graph";
import { computeAllRefillInfo, refillStatusLabel } from "@/lib/refills";
import RefillCard from "./RefillCard";

export default async function MedicinesPage() {
  const patientId = await getActivePatientId();
  const graph = getPatientGraph(patientId);
  const refills = computeAllRefillInfo(graph);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-page">
      <header className="flex items-center gap-3 border-b border-black/5 bg-white px-4 py-3">
        <Link href="/" aria-label="Go back" className="grid h-11 w-11 place-items-center rounded-full bg-black/5 text-lg">
          <span aria-hidden="true">←</span>
        </Link>
        <h1 className="text-lg font-semibold text-ink">My medicines</h1>
      </header>
      <main id="main-content" className="flex-1 space-y-3 px-4 py-4">
        {refills.length === 0 ? (
          <p className="text-sm text-ink/60">No maintenance medicines with a purchase history on file yet.</p>
        ) : (
          refills.map((info) => (
            <RefillCard key={info.medicationId} patientId={patientId} info={info} statusLabel={refillStatusLabel(info)} />
          ))
        )}
      </main>
    </div>
  );
}
