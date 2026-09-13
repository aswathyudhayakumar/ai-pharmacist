import Link from "next/link";
import { notFound } from "next/navigation";
import { BackBar } from "@/components/BackBar";
import { Card, OutlineButton } from "@/components/ui";
import { getDrugBySalt, getKnowledgeBase } from "@/lib/kb";
import { getCartCount } from "@/lib/cart";
import { addToCartAction } from "@/lib/cart-actions";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const salt = decodeURIComponent(id);
  const drug = getDrugBySalt(salt);
  if (!drug) notFound();

  const kb = getKnowledgeBase();
  const scheduleMeaning = kb.schedules[drug.schedule];
  const cartCount = await getCartCount();

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-page">
      <header className="border-b border-black/5 bg-white">
        <BackBar title={drug.salt} backHref="/search" cartCount={cartCount} />
      </header>
      <main id="main-content" className="flex-1 space-y-4 px-4 py-4">
        <Card className="space-y-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-ink">{drug.salt}</h2>
            <span className="rounded-pill bg-black/5 px-2.5 py-1 text-xs font-semibold text-ink/70">{drug.schedule}</span>
          </div>
          <p className="text-sm text-ink/70">{drug.class}</p>
          <p className="text-lg font-semibold text-ink">₹{drug.brandPriceInr}</p>
          {drug.notes && <p className="text-sm text-ink/70">{drug.notes}</p>}
          <p className="text-xs text-ink/50">{scheduleMeaning}</p>
          <form action={addToCartAction}>
            <input type="hidden" name="salt" value={drug.salt} />
            <OutlineButton type="submit">Add to cart</OutlineButton>
          </form>
        </Card>

        {drug.genericEquivalents.length > 0 && (
          <Card className="space-y-2 p-4">
            <h3 className="font-semibold text-ink">Generic equivalents</h3>
            <ul className="space-y-1 text-sm text-ink/70">
              {drug.genericEquivalents.map((g) => (
                <li key={g.brand} className="flex justify-between">
                  <span>{g.brand}</span>
                  <span className="font-medium text-ink">₹{g.priceInr}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card className="space-y-3 border border-dashed border-black/10 p-4">
          <h3 className="font-semibold text-ink">Ask your question</h3>
          <p className="text-xs text-ink/50">
            The graph-aware Health Assistant lands in a later phase (S3). This preview shows where it will sit.
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested questions, coming soon">
            {["Is this safe with my other medicines?", "How does this work?", "Cheaper alternatives?"].map((question) => (
              <button
                key={question}
                type="button"
                disabled
                aria-label={`${question} — coming soon`}
                className="min-h-11 rounded-pill border border-black/10 px-3 py-2 text-xs text-ink/40 disabled:cursor-default"
              >
                {question}
              </button>
            ))}
          </div>
          <label htmlFor="ask" className="sr-only">
            Ask anything
          </label>
          <input
            id="ask"
            type="text"
            disabled
            placeholder="Ask anything — coming in a later phase"
            className="min-h-11 w-full rounded-pill border border-black/10 px-4 py-3 text-sm text-ink/50 disabled:cursor-default"
          />
          <Link
            href="/consent"
            className="flex min-h-11 items-center gap-2 rounded-card bg-indigo-950 px-4 py-3 text-sm font-medium text-white"
          >
            <span aria-hidden="true">🔗</span> Health records
          </Link>
        </Card>
      </main>
    </div>
  );
}
