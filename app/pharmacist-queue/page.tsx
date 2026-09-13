import { BackBar } from "@/components/BackBar";
import { Card } from "@/components/ui";
import { getActivePatientId } from "@/lib/session";
import { getPatientGraph } from "@/lib/graph";
import { getCartCount } from "@/lib/cart";

export default async function PharmacistQueuePage() {
  const patientId = await getActivePatientId();
  const graph = getPatientGraph(patientId);
  const cartCount = await getCartCount();
  const rx = graph.pendingPrescription;

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
        {rx ? (
          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-ink">Prescription for {graph.patient.name}</h2>
              <span className="shrink-0 rounded-pill bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                Awaiting agent draft
              </span>
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
              The agent&rsquo;s drafted recommendation and graph reconciliation (interactions, duplications, cheaper
              generics) are built in phase S1 — this card previews the queue only.
            </p>
          </Card>
        ) : (
          <Card className="p-6 text-center text-sm text-ink/60">No items awaiting pharmacist review right now.</Card>
        )}
      </main>
    </div>
  );
}
