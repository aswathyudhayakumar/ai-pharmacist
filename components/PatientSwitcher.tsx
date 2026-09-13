import { getPatientGraph, PATIENT_IDS } from "@/lib/graph";
import { setActivePatient } from "@/lib/actions";
import type { PatientId } from "@/types/graph";

const DEMO_LABEL: Record<PatientId, string> = {
  pat_001: "P2",
  pat_002: "P1",
};

export function PatientSwitcher({ activeId }: { activeId: PatientId }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-dashed border-black/10 bg-amber-50 px-4 py-2 text-xs">
      <span className="font-semibold uppercase tracking-wide text-ink/60">Demo patient</span>
      {PATIENT_IDS.map((id) => {
        const graph = getPatientGraph(id);
        const isActive = id === activeId;
        return (
          <form key={id} action={setActivePatient}>
            <input type="hidden" name="patientId" value={id} />
            <button
              type="submit"
              aria-pressed={isActive}
              disabled={isActive}
              className={`min-h-8 rounded-pill border px-3 py-1 font-medium disabled:cursor-default ${
                isActive ? "border-coral bg-coral text-white" : "border-black/15 bg-white text-ink hover:bg-black/5"
              }`}
            >
              {graph.patient.name} ({DEMO_LABEL[id]})
            </button>
          </form>
        );
      })}
    </div>
  );
}
