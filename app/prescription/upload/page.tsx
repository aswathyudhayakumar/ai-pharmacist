import Link from "next/link";
import { getActivePatientId } from "@/lib/session";
import { getPatientGraph } from "@/lib/graph";
import UploadClient from "./UploadClient";

export default async function PrescriptionUploadPage() {
  const patientId = await getActivePatientId();
  const graph = getPatientGraph(patientId);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-page">
      <header className="flex items-center gap-3 border-b border-black/5 bg-white px-4 py-3">
        <Link href="/" aria-label="Go back" className="grid h-11 w-11 place-items-center rounded-full bg-black/5 text-lg">
          <span aria-hidden="true">←</span>
        </Link>
        <h1 className="text-lg font-semibold text-ink">Upload prescription</h1>
      </header>
      <main id="main-content" className="flex-1 space-y-5 px-4 py-4">
        <UploadClient patientId={patientId} patientName={graph.patient.name} pendingPrescription={graph.pendingPrescription} />
      </main>
    </div>
  );
}
