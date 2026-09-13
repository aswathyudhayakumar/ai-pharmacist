import type { ButtonHTMLAttributes, HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`rounded-card bg-white ring-1 ring-black/5 shadow-sm ${className}`} />;
}

export function PrimaryButton({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`min-h-11 rounded-card bg-coral px-5 py-3 text-base font-semibold text-white hover:bg-coral-dark disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    />
  );
}

export function OutlineButton({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`min-h-11 rounded-card border-2 border-coral px-5 py-2.5 text-base font-semibold text-coral hover:bg-coral-50 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    />
  );
}

export function BlackPillButton({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-pill bg-ink px-4 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    />
  );
}
