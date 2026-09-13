"use client";

import { useState, type ChangeEvent } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";

export default function PrescriptionUploadPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPreviewUrl(URL.createObjectURL(file));
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-page">
      <header className="flex items-center gap-3 border-b border-black/5 bg-white px-4 py-3">
        <Link href="/" aria-label="Go back" className="grid h-11 w-11 place-items-center rounded-full bg-black/5 text-lg">
          <span aria-hidden="true">←</span>
        </Link>
        <h1 className="text-lg font-semibold text-ink">Upload prescription</h1>
      </header>
      <main id="main-content" className="flex-1 space-y-5 px-4 py-4">
        {!fileName ? (
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
            disabled={!fileName}
            aria-label="Order everything — the agent's prescription reconciliation lands in phase S1"
            className="min-h-11 w-full rounded-card bg-coral px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Order everything
          </button>
          <button
            type="button"
            disabled={!fileName}
            aria-label="Request pharmacist to call — the live handoff lands in a later phase"
            className="min-h-11 w-full rounded-card border-2 border-ink px-4 py-3 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            Request pharmacist to call
          </button>
          <p className="text-xs text-ink/50">
            Reconciliation and the pharmacist queue are built in phase S1 — this screen previews the flow only.
          </p>
        </Card>
      </main>
    </div>
  );
}
