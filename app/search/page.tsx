import Link from "next/link";
import { BackBar } from "@/components/BackBar";
import { Card } from "@/components/ui";
import { catalogueSearch, patientLegalStatusLabel } from "@/lib/kb";
import { getCartCount } from "@/lib/cart";
import { getActivePatientId } from "@/lib/session";
import SearchResults from "./SearchResults";
import type { BaseResult } from "./SearchResults";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const cartCount = await getCartCount();
  const patientId = await getActivePatientId();
  const query = (q ?? "").trim();

  // The app's original catalogue search runs exactly as before and renders
  // immediately. When there's a query, the agentic overlay (SearchResults)
  // mounts on top of this same set — reviewing it against the patient's graph,
  // annotating and re-ranking — so the base list is never blocked on the agent.
  const drugs = catalogueSearch(query.toLowerCase());
  const baseResults: BaseResult[] = drugs.map((d) => ({
    salt: d.salt,
    brand: d.brand,
    class: d.class,
    legalStatus: patientLegalStatusLabel(d.schedule),
    priceInr: d.brandPriceInr,
  }));

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
        {query ? (
          // Keyed by patient + query so switching either forces a fresh mount
          // (and a fresh review pass) instead of showing stale annotations.
          <SearchResults key={`${patientId}:${query.toLowerCase()}`} patientId={patientId} query={query.toLowerCase()} baseResults={baseResults} />
        ) : (
          <>
            <p className="text-sm text-ink/60">Browse all medicines</p>
            <ul className="space-y-3">
              {baseResults.map((drug) => (
                <li key={drug.salt}>
                  <Card className="p-4">
                    <Link href={`/product/${encodeURIComponent(drug.salt)}`} className="block">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{drug.salt}</p>
                          <p className="text-sm text-ink/60">{drug.class}</p>
                        </div>
                        <span className="shrink-0 rounded-pill bg-black/5 px-2.5 py-1 text-xs font-semibold text-ink/70">
                          {drug.legalStatus}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-ink">₹{drug.priceInr}</p>
                    </Link>
                  </Card>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
