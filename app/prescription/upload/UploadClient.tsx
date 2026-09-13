"use client";

import { useState, type ChangeEvent } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";
import type { PatientId, PendingPrescription } from "@/types/graph";

type Phase = "idle" | "attached" | "submitting" | "submitted" | "error";

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
  const [patientMessage, setPatientMessage] = useState<string | null>(null);

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
      const data = (await res.json()) as { patientMessage?: string; error?: string };
      if (!res.ok) {
        setErrorMessage(data.error ?? "Something went wrong. Please try again or request a pharmacist call.");
        setPhase("error");
        return;
      }
      setPatientMessage(data.patientMessage ?? "Your prescription is with our pharmacist for review.");
      setPhase("submitted");
    } catch {
      setErrorMessage("Something went wrong. Please try again or request a pharmacist call.");
      setPhase("error");
    }
  }

  if (phase === "submitted") {
    return (
      <Card className="space-y-3 p-6 text-center" role="status">
        <p className="text-2xl" aria-hidden="true">
          ✅
        </p>
        <p className="font-semibold text-ink">{patientMessage}</p>
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
          {phase === "submitting" ? "Sending to your pharmacist…" : "Order everything"}
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
            No prescription on file for {patientName} in this prototype — switch to Lakshmi Rao (P2) on the home
            screen to see this flow end to end.
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
