import { BackBar } from "@/components/BackBar";
import { Card, PrimaryButton } from "@/components/ui";
import { getActivePatientId } from "@/lib/session";
import { getPatientGraph } from "@/lib/graph";
import { grantConsentAction, revokeConsentAction } from "@/lib/actions";
import { getCartCount } from "@/lib/cart";

export default async function ConsentPage() {
  const patientId = await getActivePatientId();
  const graph = getPatientGraph(patientId);
  const cartCount = await getCartCount();
  const granted = graph.consentStatus === "granted";

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-page">
      <header className="border-b border-black/5 bg-white">
        <BackBar title="Health records consent" showSearch={false} cartCount={cartCount} />
      </header>
      <main id="main-content" className="flex-1 space-y-4 px-4 py-4">
        <Card className="space-y-3 p-4">
          <h2 className="font-semibold text-ink">Let the agent read your health records?</h2>
          <p className="text-sm text-ink/70">
            Purpose: so the Health Assistant can check your medicines, conditions and allergies before answering a
            question or raising a flag — never to sell or share your data.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink/70">
            <li>Data types: medicines, lab results, prescriptions</li>
            <li>Duration: until you revoke it</li>
            <li>You can revoke at any time — this stops agent access and erases the imported data</li>
          </ul>
          <p className="text-xs text-ink/50">
            Current status for {graph.patient.name}:{" "}
            <span className={granted ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
              {granted ? "Granted" : "Not granted"}
            </span>
          </p>
          {!granted ? (
            <form action={grantConsentAction}>
              <input type="hidden" name="patientId" value={patientId} />
              <PrimaryButton type="submit" className="w-full">
                Grant consent &amp; import ABDM records
              </PrimaryButton>
            </form>
          ) : (
            <form action={revokeConsentAction}>
              <input type="hidden" name="patientId" value={patientId} />
              <button type="submit" className="min-h-11 w-full rounded-card border-2 border-ink px-4 py-3 font-semibold text-ink">
                Revoke consent
              </button>
            </form>
          )}
        </Card>

        {graph.abdmAvailable && (
          <Card className="space-y-2 p-4">
            <h3 className="font-semibold text-ink">Available via ABDM (simulated)</h3>
            <ul className="space-y-1 text-sm text-ink/70">
              {graph.abdmAvailable.conditions.map((c) => (
                <li key={c.id}>Condition: {c.name}</li>
              ))}
              {graph.abdmAvailable.currentMedications.map((m) => (
                <li key={m.id}>
                  Medicine: {m.brand} ({m.salt})
                </li>
              ))}
            </ul>
          </Card>
        )}

        {granted && (
          <Card className="space-y-2 p-4">
            <h3 className="font-semibold text-ink">In the working graph now</h3>
            <ul className="space-y-1 text-sm text-ink/70">
              {graph.conditions.map((c) => (
                <li key={c.id}>Condition: {c.name}</li>
              ))}
              {graph.currentMedications.map((m) => (
                <li key={m.id}>
                  Medicine: {m.brand} ({m.salt})
                </li>
              ))}
              {graph.conditions.length === 0 && graph.currentMedications.length === 0 && (
                <li className="text-ink/50">Nothing yet.</li>
              )}
            </ul>
          </Card>
        )}
      </main>
    </div>
  );
}
