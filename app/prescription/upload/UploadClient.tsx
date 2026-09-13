"use client";

import { useState, type ChangeEvent } from "react";
import Link from "next/link";
import { Card, PrimaryButton } from "@/components/ui";
import type { PatientId, PendingPrescription } from "@/types/graph";
import type { PreparedOrder } from "@/types/reconciliation";

type Phase = "idle" | "attached" | "submitting" | "ready" | "queued" | "paid" | "error";

export default function UploadClient({
  patientId,
  patientName,
  pendingPrescription,
}: {
  patientId: PatientId;
  patientName: string;
  pendingPrescription: PendingPrescription | undefined;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [order, setOrder] = useState<PreparedOrder | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPreviewUrl(URL.createObjectURL(file));
    setPhase("attached");
  }

  async function handleOrderEverything() {
    setPhase("submitting");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, surface: "S1_prescription" }),
      });
      const data = (await res.json()) as PreparedOrder & { error?: string };
      if (!res.ok) {
        setErrorMessage(data.error ?? "Something went wrong. Please try again or request a pharmacist call.");
        setPhase("error");
        return;
      }
      setOrder(data);
      setPhase(data.routingOutcome === "auto_ready" ? "ready" : "queued");
    } catch {
      setErrorMessage("Something went wrong. Please try again or request a pharmacist call.");
      setPhase("error");
    }
  }

  if (phase === "paid" && order) {
    return (
      <Card className="space-y-3 p-6 text-center" role="status">
        <p className="text-2xl" aria-hidden="true">
          ✅
        </p>
        <p className="font-semibold text-ink">Order placed — ₹{order.totalInr} paid.</p>
        <p className="text-xs text-ink/50">{order.earliestDelivery ?? "Delivery estimate on the way."}</p>
      </Card>
    );
  }

  if (phase === "ready" && order) {
    return (
      <Card className="space-y-3 p-4">
        <p className="text-sm text-ink/70">{order.summary}</p>
        <ul className="space-y-2">
          {order.items.map((item) => (
            <li key={item.salt} className="flex items-start justify-between gap-3 text-sm">
              <span>
                {item.brand}
                {item.strength ? ` ${item.strength}` : ""}
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-medium text-ink">₹{item.unitPriceInr}</span>
                {item.genericSavingNote && <span className="block text-xs text-emerald-700">{item.genericSavingNote}</span>}
              </span>
            </li>
          ))}
        </ul>

        {order.findings.length > 0 && (
          <ul className="space-y-2">
            {order.findings.map((finding) => (
              <li key={finding.id} className="rounded-card border border-black/10 p-3">
                <p className="font-medium text-ink">{finding.label}</p>
                <p className="text-sm text-ink/80">{finding.explanation}</p>
                <details className="mt-1 text-xs text-ink/60">
                  <summary className="cursor-pointer font-medium text-coral">Why? — source</summary>
                  <p className="mt-1">Source: {finding.sourceIds.join(", ")}</p>
                  <pre className="mt-1 overflow-x-auto rounded bg-black/5 p-2 text-[11px]">{JSON.stringify(finding.detail, null, 2)}</pre>
                </details>
              </li>
            ))}
          </ul>
        )}

        {order.coupon && <p className="text-sm font-medium text-emerald-700">{order.coupon}</p>}
        {order.earliestDelivery && <p className="text-sm text-ink/70">Delivery: {order.earliestDelivery}</p>}

        <div className="flex items-center justify-between border-t border-black/10 pt-3">
          <span className="font-semibold text-ink">Total</span>
          <span className="font-semibold text-ink">₹{order.totalInr}</span>
        </div>

        <PrimaryButton type="button" className="w-full" onClick={() => setPhase("paid")}>
          Pay ₹{order.totalInr} and place order
        </PrimaryButton>
        <p className="text-xs text-ink/50">Nothing here needs a prescription — one tap places the order.</p>
      </Card>
    );
  }

  if (phase === "queued" && order) {
    return (
      <Card className="space-y-3 p-4">
        <p className="font-semibold text-ink">Here&rsquo;s what we&rsquo;ve prepared</p>
        <ul className="space-y-2">
          {order.items.map((item) => (
            <li key={item.salt} className="flex items-start justify-between gap-3 text-sm">
              <span>
                {item.brand}
                {item.strength ? ` ${item.strength}` : ""}
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-medium text-ink">₹{item.unitPriceInr}</span>
                {item.genericSavingNote && <span className="block text-xs text-emerald-700">{item.genericSavingNote}</span>}
              </span>
            </li>
          ))}
        </ul>
        <p className="rounded-card bg-amber-50 p-3 text-sm text-amber-900">{order.legalNote}</p>
        <p className="text-xs text-ink/50">
          For this demo, you can watch the pharmacist&rsquo;s side at{" "}
          <Link href="/pharmacist-queue" className="font-semibold text-coral">
            the pharmacist queue
          </Link>
          .
        </p>
      </Card>
    );
  }

  const hasFile = phase === "attached" || phase === "submitting" || phase === "error";
  const canOrder = (phase === "attached" || phase === "error") && Boolean(pendingPrescription);

  return (
    <>
      {!hasFile ? (
        <Card className="space-y-3 border-2 border-dashed border-coral/40 p-6 text-center">
          <p className="text-sm text-ink/70">Upload a photo or PDF of your prescription. You can attach up to 20.</p>
          <label className="mx-auto flex w-fit cursor-pointer items-center gap-2 rounded-card bg-coral px-6 py-3 text-base font-semibold text-white">
            Choose file
            <input type="file" accept="image/*,.pdf" className="sr-only" onChange={handleFileChange} />
          </label>
        </Card>
      ) : (
        <Card className="space-y-3 p-4 text-center">
          <p className="font-semibold text-ink">1 prescription attached</p>
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview, next/image doesn't support blob: URLs
            <img
              src={previewUrl}
              alt={`Preview of uploaded file ${fileName}`}
              className="mx-auto max-h-64 rounded-card border border-black/10"
            />
          )}
          <p className="text-xs text-ink/50">{fileName}</p>
          <label className="mx-auto flex w-fit cursor-pointer items-center gap-2 text-sm font-semibold text-coral">
            Upload a different file
            <input type="file" accept="image/*,.pdf" className="sr-only" onChange={handleFileChange} />
          </label>
        </Card>
      )}

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold text-ink">How would you like us to process your request?</h2>
        <button
          type="button"
          disabled={!canOrder}
          onClick={handleOrderEverything}
          aria-label={
            pendingPrescription
              ? "Order everything from this prescription"
              : `No prescription on file for ${patientName} in this prototype`
          }
          className="min-h-11 w-full rounded-card bg-coral px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {phase === "submitting" ? "Preparing your order…" : "Order everything"}
        </button>
        <button
          type="button"
          disabled
          aria-label="Request pharmacist to call — the live handoff lands in a later phase"
          className="min-h-11 w-full rounded-card border-2 border-ink px-4 py-3 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          Request pharmacist to call
        </button>
        {!pendingPrescription && (
          <p className="text-xs text-ink/50">
            No prescription on file for {patientName} in this prototype — switch patients on the home screen to see
            this flow end to end.
          </p>
        )}
        {phase === "error" && errorMessage && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {errorMessage}
          </p>
        )}
      </Card>
    </>
  );
}
