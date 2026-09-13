"use client";

import { useState } from "react";
import { addToCartAction } from "@/lib/cart-actions";
import { Card, PrimaryButton } from "@/components/ui";
import type { PatientId } from "@/types/graph";
import type { RefillInfo, RefillProposal } from "@/types/refill";

type Phase = "idle" | "loading" | "ready" | "confirmed" | "error";

export default function RefillCard({
  patientId,
  info,
  statusLabel,
}: {
  patientId: PatientId;
  info: RefillInfo;
  statusLabel: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [proposal, setProposal] = useState<RefillProposal | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleReview() {
    setPhase("loading");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, surface: "S4_refill", medicationId: info.medicationId }),
      });
      const data = (await res.json()) as RefillProposal & { error?: string };
      if (!res.ok) {
        setErrorMessage(data.error ?? "Couldn't prepare a refill proposal right now.");
        setPhase("error");
        return;
      }
      setProposal(data);
      setPhase("ready");
    } catch {
      setErrorMessage("Couldn't prepare a refill proposal right now.");
      setPhase("error");
    }
  }

  async function handleConfirm() {
    if (!proposal) return;
    const formData = new FormData();
    formData.set("salt", proposal.salt);
    await addToCartAction(formData);
    setPhase("confirmed");
  }

  const isOverdue = info.status === "overdue";
  const canReview = info.status !== "on_track";

  return (
    <Card className="space-y-3 p-4">
      <div>
        <p className="font-semibold text-ink">
          {info.brand}
          {info.strength ? ` ${info.strength}` : ""}
        </p>
        <p className={`text-sm ${isOverdue ? "font-medium text-amber-700" : "text-ink/60"}`}>{statusLabel}</p>
      </div>

      {phase !== "ready" && phase !== "confirmed" && (
        <PrimaryButton
          type="button"
          className="w-full"
          onClick={handleReview}
          disabled={!canReview || phase === "loading"}
          aria-label={canReview ? `Review refill for ${info.brand}` : `${info.brand} isn't due for a refill yet`}
        >
          {phase === "loading" ? "Checking your refill…" : "Review refill"}
        </PrimaryButton>
      )}

      {phase === "error" && errorMessage && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {errorMessage}
        </p>
      )}

      {phase === "ready" && proposal && (
        <div className="space-y-3 rounded-card bg-coral-50 p-3">
          <p className="text-xs font-semibold text-coral">
            {proposal.findings.length > 0
              ? "Checked against your current meds just now"
              : "Checked against your current meds just now — no new interactions"}
          </p>
          <p className="text-sm text-ink">{proposal.message}</p>

          {proposal.genericSaving && (
            <p className="text-sm font-medium text-emerald-700">
              Generic available — {proposal.genericSaving.brand} saves ₹{proposal.genericSaving.savingInr}
            </p>
          )}

          {proposal.findings.length > 0 && (
            <ul className="space-y-2">
              {proposal.findings.map((f) => (
                <li key={f.id} className="rounded-card border border-black/10 bg-white p-3">
                  <p className="font-medium text-ink">{f.label}</p>
                  <p className="text-sm text-ink/80">{f.explanation}</p>
                  <details className="mt-1 text-xs text-ink/60">
                    <summary className="cursor-pointer font-medium text-coral">Why? — source</summary>
                    <p className="mt-1">Source: {f.sourceIds.join(", ")}</p>
                    <pre className="mt-1 overflow-x-auto rounded bg-black/5 p-2 text-[11px]">{JSON.stringify(f.detail, null, 2)}</pre>
                  </details>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between border-t border-black/10 pt-3">
            <span className="text-sm text-ink/70">Refill price</span>
            <span className="font-semibold text-ink">₹{proposal.unitPriceInr}</span>
          </div>

          <PrimaryButton type="button" className="w-full" onClick={handleConfirm}>
            Confirm &amp; add to cart
          </PrimaryButton>
          <p className="text-xs text-ink/50">This adds one refill to your cart — paying and checking out is still your own tap.</p>
        </div>
      )}

      {phase === "confirmed" && (
        <p role="status" className="text-sm font-medium text-emerald-700">
          Added to cart. Nothing is purchased until you check out.
        </p>
      )}
    </Card>
  );
}
