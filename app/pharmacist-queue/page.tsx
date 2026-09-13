import { BackBar } from "@/components/BackBar";
import { Card } from "@/components/ui";
import { getActivePatientId } from "@/lib/session";
import { getPatientGraph } from "@/lib/graph";
import { getCartCount } from "@/lib/cart";
import { getDraft } from "@/lib/queue";
import { dispatchDraftAction, rejectDraftAction } from "@/lib/queue-actions";

const SEVERITY_BADGE: Record<string, string> = {
  major: "bg-red-100 text-red-800",
  high: "bg-red-100 text-red-800",
  moderate: "bg-amber-100 text-amber-800",
  minor: "bg-amber-50 text-amber-700",
  info: "bg-emerald-100 text-emerald-800",
};

export default async function PharmacistQueuePage() {
  const patientId = await getActivePatientId();
  const graph = getPatientGraph(patientId);
  const cartCount = await getCartCount();
  const rx = graph.pendingPrescription;
  const draft = getDraft(patientId);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-page">
      <header className="border-b border-black/5 bg-white">
        <BackBar title="Pharmacist queue" showSearch={false} cartCount={cartCount} />
      </header>
      <main id="main-content" className="flex-1 space-y-4 px-4 py-4">
        <p className="text-sm text-ink/60">
          Rx items and clinically ambiguous items land here for a registered pharmacist to confirm, edit, or reject —
          nothing dispatches without their sign-off.
        </p>

        {!rx && !draft && <Card className="p-6 text-center text-sm text-ink/60">No items awaiting pharmacist review right now.</Card>}

        {rx && !draft && (
          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-ink">Prescription for {graph.patient.name}</h2>
              <span className="shrink-0 rounded-pill bg-black/5 px-2.5 py-1 text-xs font-semibold text-ink/60">Not yet drafted</span>
            </div>
            <p className="text-sm text-ink/70">
              Reason: {rx.reason ?? "Not specified"} · dated {rx.date}
            </p>
            <ul className="space-y-1 text-sm text-ink/80">
              {rx.items.map((item) => (
                <li key={item.brand} className="flex justify-between">
                  <span>
                    {item.brand}
                    {item.strength ? ` ${item.strength}` : ""}
                  </span>
                  <span className="text-ink/50">{item.salt}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-ink/50">
              Ask the patient to go to Upload prescription → Order everything to generate the agent&rsquo;s draft.
            </p>
          </Card>
        )}

        {draft && (
          <>
            <Card className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-ink">Draft for {graph.patient.name}</h2>
                <span
                  className={`shrink-0 rounded-pill px-2.5 py-1 text-xs font-semibold ${
                    draft.status === "awaiting_pharmacist"
                      ? "bg-amber-100 text-amber-800"
                      : draft.status === "dispatched"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-red-100 text-red-800"
                  }`}
                >
                  {draft.status === "awaiting_pharmacist" ? "Awaiting review" : draft.status === "dispatched" ? "Dispatched" : "Rejected"}
                </span>
              </div>
              <p className="text-sm text-ink/70">{draft.summary}</p>
              <ul className="space-y-1 text-xs text-ink/50">
                {draft.legalSchedules.map((s) => (
                  <li key={s.salt}>
                    {s.salt}: schedule {s.schedule}
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="space-y-3 p-4">
              <h3 className="font-semibold text-ink">Findings the agent flagged</h3>
              {draft.findings.length === 0 && <p className="text-sm text-ink/60">No findings were surfaced for this prescription.</p>}
              <ul className="space-y-3">
                {draft.findings.map((finding) => (
                  <li key={finding.id} className="rounded-card border border-black/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-ink">{finding.label}</span>
                      <span
                        className={`shrink-0 rounded-pill px-2 py-0.5 text-xs font-semibold ${SEVERITY_BADGE[finding.severity.toLowerCase()] ?? "bg-black/5 text-ink/60"}`}
                      >
                        {finding.type === "generic_saving" ? "Savings tip" : finding.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink/80">{finding.explanation}</p>
                    <details className="mt-2 text-xs text-ink/60">
                      <summary className="cursor-pointer font-medium text-coral">Why? — source</summary>
                      <p className="mt-1">Source: {finding.sourceIds.join(", ")}</p>
                      <pre className="mt-1 overflow-x-auto rounded bg-black/5 p-2 text-[11px]">{JSON.stringify(finding.detail, null, 2)}</pre>
                    </details>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="space-y-3 p-4">
              <h3 className="font-semibold text-ink">Drafted pharmacist selections</h3>
              {draft.status === "awaiting_pharmacist" ? (
                <form action={dispatchDraftAction} className="space-y-3">
                  <input type="hidden" name="patientId" value={patientId} />
                  <fieldset className="space-y-2">
                    <legend className="sr-only">Medicines to include in this order</legend>
                    {draft.pharmacistSelections.medsToAdd.map((salt) => (
                      <label key={salt} className="flex min-h-11 items-center gap-2 text-sm text-ink">
                        <input type="checkbox" name="includeSalt" value={salt} defaultChecked className="h-5 w-5" />
                        {salt}
                      </label>
                    ))}
                  </fieldset>
                  {draft.pharmacistSelections.bestCoupon && (
                    <p className="text-sm text-ink/70">Coupon: {draft.pharmacistSelections.bestCoupon}</p>
                  )}
                  {draft.pharmacistSelections.earliestDelivery && (
                    <p className="text-sm text-ink/70">Delivery: {draft.pharmacistSelections.earliestDelivery}</p>
                  )}
                  <div className="flex gap-2">
                    <button type="submit" className="min-h-11 flex-1 rounded-card bg-coral px-4 py-3 font-semibold text-white">
                      Confirm &amp; dispatch checked items
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-1 text-sm text-ink/70">
                  {draft.pharmacistSelections.medsToAdd.map((salt) => (
                    <p key={salt}>
                      {salt}
                      {draft.dispatchedSalts?.includes(salt) ? " — dispatched" : ""}
                    </p>
                  ))}
                </div>
              )}
              {draft.status === "awaiting_pharmacist" && (
                <form action={rejectDraftAction}>
                  <input type="hidden" name="patientId" value={patientId} />
                  <button type="submit" className="min-h-11 w-full rounded-card border-2 border-ink px-4 py-3 font-semibold text-ink">
                    Reject prescription
                  </button>
                </form>
              )}
              <p className="text-xs text-ink/50">
                Dispatch and reject are pharmacist-only actions in this UI — the agent can draft, it can never call
                either.
              </p>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
