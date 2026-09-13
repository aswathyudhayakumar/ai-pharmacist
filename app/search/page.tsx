import Link from "next/link";
import { BackBar } from "@/components/BackBar";
import { Card } from "@/components/ui";
import { findSubstitutionTrap, getKnowledgeBase, patientLegalStatusLabel } from "@/lib/kb";
import { getCartCount } from "@/lib/cart";
import { getActivePatientId } from "@/lib/session";
import ComposedSearchResults from "./ComposedSearchResults";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const cartCount = await getCartCount();
  const patientId = await getActivePatientId();
  const kb = getKnowledgeBase();
  const query = (q ?? "").trim().toLowerCase();

  // A condition/symptom query gets routed to the agent-composed, graph-aware
  // path instead of the plain catalogue filter below (FR-S3) — this is what
  // catches "diabetes medicine" surfacing a homeopathic drop as if it treats
  // the condition, rather than the patient's actual prescribed treatment.
  const trap = query ? findSubstitutionTrap(query) : undefined;

  const results = query && !trap ? kb.drugs.filter((d) => d.salt.toLowerCase().includes(query) || d.class.toLowerCase().includes(query)) : kb.drugs;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-page">
      <header className="border-b border-black/5 bg-white">
        <BackBar title="Search" cartCount={cartCount} showSearch={false} />
        <form action="/search" className="px-4 pb-3">
          <label htmlFor="q" className="sr-only">
            Search medicines
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q ?? ""}
            placeholder="Search paracetamol"
            className="min-h-11 w-full rounded-pill border border-black/10 px-4 py-3 text-ink"
          />
        </form>
      </header>
      <main id="main-content" className="flex-1 space-y-3 px-4 py-4">
        {trap ? (
          // Keyed by patient + query so switching either forces a fresh
          // mount (and a fresh "loading" state) instead of flashing stale
          // results from the previous fetch while the new one is in flight.
          <ComposedSearchResults key={`${patientId}:${query}`} patientId={patientId} query={query} />
        ) : (
          <>
            <p className="text-sm text-ink/60">
              {query ? `${results.length} result${results.length === 1 ? "" : "s"} for "${q}"` : "Browse all medicines"}
            </p>
            <ul className="space-y-3">
              {results.map((drug) => (
                <li key={drug.salt}>
                  <Card className="p-4">
                    <Link href={`/product/${encodeURIComponent(drug.salt)}`} className="block">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{drug.salt}</p>
                          <p className="text-sm text-ink/60">{drug.class}</p>
                        </div>
                        <span className="shrink-0 rounded-pill bg-black/5 px-2.5 py-1 text-xs font-semibold text-ink/70">
                          {patientLegalStatusLabel(drug.schedule)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-ink">₹{drug.brandPriceInr}</p>
                    </Link>
                  </Card>
                </li>
              ))}
              {query && results.length === 0 && (
                <li className="rounded-card bg-white p-4 text-sm text-ink/60">
                  No matches in the seeded catalogue. Try “paracetamol” or “metformin”.
                </li>
              )}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
