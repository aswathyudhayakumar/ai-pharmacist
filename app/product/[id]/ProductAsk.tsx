"use client";

import { useState, type FormEvent } from "react";
import { Card } from "@/components/ui";
import type { PatientId } from "@/types/graph";
import type { ProductQaResult } from "@/types/productQa";

type State =
  | { status: "idle" }
  | { status: "loading"; question: string }
  | { status: "ok"; question: string; result: ProductQaResult }
  | { status: "error"; question: string; message: string };

const SEVERITY_BADGE: Record<string, string> = {
  major: "bg-red-100 text-red-800",
  high: "bg-red-100 text-red-800",
  moderate: "bg-amber-100 text-amber-800",
  minor: "bg-amber-50 text-amber-700",
};

const SUGGESTED_QUESTIONS = ["Can I take this?", "Is this safe with my other medicines?", "How does this work?"];

export default function ProductAsk({ patientId, salt }: { patientId: PatientId; salt: string }) {
  const [state, setState] = useState<State>({ status: "idle" });
  const [input, setInput] = useState("");
  const [calledPharmacist, setCalledPharmacist] = useState(false);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed) return;
    setCalledPharmacist(false);
    setState({ status: "loading", question: trimmed });
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, surface: "S3_qa", query: trimmed, productSalt: salt }),
      });
      const data = (await res.json()) as ProductQaResult & { error?: string };
      if (!res.ok) {
        setState({ status: "error", question: trimmed, message: data.error ?? "Couldn't answer that right now." });
        return;
      }
      setState({ status: "ok", question: trimmed, result: data });
    } catch {
      setState({ status: "error", question: trimmed, message: "Couldn't answer that right now." });
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const question = input;
    setInput("");
    void ask(question);
  }

  const isLoading = state.status === "loading";

  return (
    <Card className="space-y-3 border border-dashed border-black/10 p-4">
      <h3 className="font-semibold text-ink">Ask your question</h3>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested questions">
        {SUGGESTED_QUESTIONS.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => void ask(question)}
            disabled={isLoading}
            className="min-h-11 rounded-pill border border-black/10 px-3 py-2 text-xs text-ink hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {question}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <label htmlFor="ask" className="sr-only">
          Ask anything
        </label>
        <input
          id="ask"
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={isLoading}
          placeholder="Ask anything"
          className="min-h-11 w-full rounded-pill border border-black/10 px-4 py-3 text-sm text-ink disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          aria-label="Ask"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-coral text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span aria-hidden="true">→</span>
        </button>
      </form>

      {state.status !== "idle" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <p className="max-w-[80%] rounded-2xl rounded-br-sm bg-blue-600 px-4 py-2.5 text-sm text-white">{state.question}</p>
          </div>

          {state.status === "loading" && (
            <p className="text-sm text-ink/60" role="status" aria-live="polite">
              Checking this against your health records…
            </p>
          )}

          {state.status === "error" && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {state.message}
            </p>
          )}

          {state.status === "ok" && (
            <div className="space-y-3">
              <p className="text-sm text-ink/90">{state.result.answer}</p>

              {state.result.findings.length > 0 && (
                <ul className="space-y-2">
                  {state.result.findings.map((finding) => (
                    <li key={finding.id} className="rounded-card border border-black/10 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-ink">{finding.label}</span>
                        <span
                          className={`shrink-0 rounded-pill px-2 py-0.5 text-xs font-semibold ${
                            SEVERITY_BADGE[finding.severity.toLowerCase()] ?? "bg-black/5 text-ink/60"
                          }`}
                        >
                          {finding.severity}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-ink/80">{finding.explanation}</p>
                      <details className="mt-2 text-xs text-ink/60">
                        <summary className="cursor-pointer font-medium text-coral">Why? — source</summary>
                        <p className="mt-1">Source: {finding.sourceIds.join(", ")}</p>
                        <pre className="mt-1 overflow-x-auto rounded bg-black/5 p-2 text-[11px]">{JSON.stringify(finding.detail, null, 2)}</pre>
                      </details>
                    </li>
                  ))}
                </ul>
              )}

              {!calledPharmacist ? (
                <button
                  type="button"
                  onClick={() => setCalledPharmacist(true)}
                  className="min-h-11 w-full rounded-card border-2 border-ink px-4 py-3 text-sm font-semibold text-ink"
                >
                  Talk to a pharmacist
                </button>
              ) : (
                <p className="rounded-card bg-emerald-50 p-3 text-sm text-emerald-800" role="status">
                  A pharmacist will call you shortly — this question and answer travel with the call so it starts
                  informed.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
