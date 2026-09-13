"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import type { PatientId } from "@/types/graph";
import type { ComposedSearchResult, SearchFinding } from "@/types/search";

type State = { status: "loading" } | { status: "ok"; result: ComposedSearchResult } | { status: "error"; message: string };

const BADGE_CLASS: Record<SearchFinding["type"], string> = {
  promoted_treatment: "bg-emerald-100 text-emerald-800",
  unsafe_substitution: "bg-red-100 text-red-800",
};

const BADGE_LABEL: Record<SearchFinding["type"], string> = {
  promoted_treatment: "Your prescribed treatment",
  unsafe_substitution: "Not a substitute",
};

export default function ComposedSearchResults({ patientId, query }: { patientId: PatientId; query: string }) {
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
          setState({ status: "error", message: data.error ?? "Couldn't compose safety-aware results right now." });
          return;
        }
        setState({ status: "ok", result: data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", message: "Couldn't compose safety-aware results right now." });
      });

    return () => {
      cancelled = true;
    };
  }, [patientId, query]);

  if (state.status === "loading") {
    return (
      <Card className="space-y-2 p-4" role="status" aria-live="polite">
        <p className="text-sm text-ink/60">Checking this against your health records…</p>
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card className="space-y-2 p-4" role="alert">
        <p className="text-sm font-medium text-red-700">{state.message}</p>
        <p className="text-xs text-ink/60">Try searching a specific medicine name instead, or use Ask a pharmacist.</p>
      </Card>
    );
  }

  const { result } = state;

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink/60">{result.summary}</p>
      <ul className="space-y-3">
        {result.findings.map((finding) => (
          <li key={finding.id}>
            <Card className={`space-y-2 p-4 ${finding.type === "promoted_treatment" ? "ring-2 ring-emerald-400" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-ink">{finding.label}</span>
                <span className={`shrink-0 rounded-pill px-2 py-0.5 text-xs font-semibold ${BADGE_CLASS[finding.type]}`}>
                  {BADGE_LABEL[finding.type]}
                </span>
              </div>
              <p className="text-sm text-ink/80">{finding.explanation}</p>
              <details className="text-xs text-ink/60">
                <summary className="cursor-pointer font-medium text-coral">Why? — source</summary>
                <p className="mt-1">Source: {finding.sourceIds.join(", ")}</p>
                <pre className="mt-1 overflow-x-auto rounded bg-black/5 p-2 text-[11px]">{JSON.stringify(finding.detail, null, 2)}</pre>
              </details>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
