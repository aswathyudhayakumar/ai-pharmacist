"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";
import type { PatientId } from "@/types/graph";
import type { ComposedSearchResult, SearchFlag, SearchResultItem } from "@/types/search";

export interface BaseResult {
  salt: string;
  brand?: string;
  class: string;
  legalStatus: string;
  priceInr: number;
}

type State =
  | { status: "loading" }
  | { status: "ok"; result: ComposedSearchResult }
  | { status: "error"; message: string };

const TYPE_BADGE: Partial<Record<SearchResultItem["type"], { label: string; cls: string; ring: string }>> = {
  promoted_treatment: { label: "Your prescribed treatment", cls: "bg-emerald-100 text-emerald-800", ring: "ring-2 ring-emerald-400" },
  pharmacist_review_alternative: { label: "Needs pharmacist review", cls: "bg-amber-100 text-amber-900", ring: "ring-2 ring-amber-300" },
  unsafe_substitution: { label: "Not a substitute", cls: "bg-red-100 text-red-800", ring: "" },
};

function flagDotClass(flag: SearchFlag): string {
  if (flag.kind === "generic_saving") return "bg-emerald-500";
  const sev = flag.severity.toLowerCase();
  if (sev === "major" || sev === "high") return "bg-red-500";
  if (sev === "moderate") return "bg-amber-500";
  return "bg-yellow-400";
}

function OverlayCard({ item }: { item: SearchResultItem }) {
  const badge = TYPE_BADGE[item.type];
  const clickable = item.type === "catalogue_result" || item.type === "promoted_treatment";

  const header = (
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="font-semibold text-ink">{item.label}</p>
        {item.class && <p className="text-sm text-ink/60">{item.class}</p>}
      </div>
      {badge ? (
        <span className={`shrink-0 rounded-pill px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
      ) : (
        item.legalStatus && (
          <span className="shrink-0 rounded-pill bg-black/5 px-2.5 py-1 text-xs font-semibold text-ink/70">{item.legalStatus}</span>
        )
      )}
    </div>
  );

  return (
    <Card className={`space-y-2 p-4 ${badge?.ring ?? ""}`}>
      {clickable ? (
        <Link href={`/product/${encodeURIComponent(item.salt)}`} className="block">
          {header}
        </Link>
      ) : (
        header
      )}

      {typeof item.priceInr === "number" && <p className="text-sm font-semibold text-ink">₹{item.priceInr}</p>}
      {item.explanation && <p className="text-sm text-ink/80">{item.explanation}</p>}

      {item.type === "pharmacist_review_alternative" && (
        <p className="rounded-card bg-amber-50 p-2 text-xs text-amber-900">
          A pharmacist can review whether this suits you before it can be dispensed — nothing here is ordered without that review.
        </p>
      )}

      {item.flags.length > 0 && (
        <ul className="space-y-1.5">
          {item.flags.map((flag) => (
            <li key={flag.id} className="flex items-start gap-2 text-sm">
              <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${flagDotClass(flag)}`} />
              <span className="text-ink/80">
                <span className="font-medium text-ink">{flag.label}. </span>
                {flag.explanation}
              </span>
            </li>
          ))}
        </ul>
      )}

      {(item.flags.length > 0 || item.sourceIds.length > 0) && (
        <details className="text-xs text-ink/60">
          <summary className="cursor-pointer font-medium text-coral">Why? — source</summary>
          <p className="mt-1">Item source: {item.sourceIds.join(", ")}</p>
          {item.flags.map((flag) => (
            <div key={flag.id} className="mt-1">
              <p>Flag source: {flag.sourceIds.join(", ")}</p>
              <pre className="mt-1 overflow-x-auto rounded bg-black/5 p-2 text-[11px]">{JSON.stringify(flag.detail, null, 2)}</pre>
            </div>
          ))}
        </details>
      )}
    </Card>
  );
}

function BaseCard({ drug }: { drug: BaseResult }) {
  return (
    <Card className="p-4">
      <Link href={`/product/${encodeURIComponent(drug.salt)}`} className="block">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-ink">{drug.salt}</p>
            <p className="text-sm text-ink/60">{drug.class}</p>
          </div>
          <span className="shrink-0 rounded-pill bg-black/5 px-2.5 py-1 text-xs font-semibold text-ink/70">{drug.legalStatus}</span>
        </div>
        <p className="mt-2 text-sm font-semibold text-ink">₹{drug.priceInr}</p>
      </Link>
    </Card>
  );
}

export default function SearchResults({
  patientId,
  query,
  baseResults,
}: {
  patientId: PatientId;
  query: string;
  baseResults: BaseResult[];
}) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId, surface: "S2_search", query }),
    })
      .then(async (res) => {
        const data = (await res.json()) as ComposedSearchResult & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setState({ status: "error", message: data.error ?? "Couldn't review these results right now." });
          return;
        }
        setState({ status: "ok", result: data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", message: "Couldn't review these results right now." });
      });

    return () => {
      cancelled = true;
    };
  }, [patientId, query]);

  // The status strip narrates the agentic layer; the list below shows the
  // app's instant base results until the reviewed set arrives, then swaps to it.
  return (
    <div className="space-y-3">
      <div role="status" aria-live="polite">
        {state.status === "loading" && (
          <div className="flex items-center gap-2 rounded-card bg-coral-50 px-3 py-2 text-sm text-ink/70">
            <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-coral" />
            Reviewing {baseResults.length > 0 ? `${baseResults.length} result${baseResults.length === 1 ? "" : "s"}` : "this search"} against your health records…
          </div>
        )}
        {state.status === "ok" && <p className="text-sm text-ink/60">{state.result.summary}</p>}
        {state.status === "error" && (
          <p className="rounded-card bg-black/5 px-3 py-2 text-xs text-ink/60">
            Showing standard results — couldn&rsquo;t review against your records just now.
          </p>
        )}
      </div>

      {state.status === "ok" ? (
        state.result.items.length === 0 ? (
          <p className="rounded-card bg-white p-4 text-sm text-ink/60">No matches. Try “paracetamol” or “diabetes medicine”.</p>
        ) : (
          <ul className="space-y-3">
            {state.result.items.map((item) => (
              <li key={item.id}>
                <OverlayCard item={item} />
              </li>
            ))}
          </ul>
        )
      ) : baseResults.length === 0 ? (
        <p className="rounded-card bg-white p-4 text-sm text-ink/60">No matches in the seeded catalogue. Try “paracetamol” or “metformin”.</p>
      ) : (
        <ul className="space-y-3">
          {baseResults.map((drug) => (
            <li key={drug.salt}>
              <BaseCard drug={drug} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
