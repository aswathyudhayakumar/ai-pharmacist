import Link from "next/link";

export function TopBar({ cartCount = 0 }: { cartCount?: number }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <button
        type="button"
        disabled
        aria-label="Delivery location: Home, 1102 Tower 11, Shabhari Nagar. Location switching is not available in this prototype."
        className="flex min-h-11 max-w-[62%] items-center gap-1.5 truncate rounded-pill border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-ink disabled:cursor-default disabled:opacity-100"
      >
        <span aria-hidden="true" className="text-coral">
          📍
        </span>
        <span className="truncate">
          <span className="font-semibold">Home</span> 1102, Tower 11, Shabhari…
        </span>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          disabled
          aria-label="Profile — not available in this prototype"
          className="grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white text-lg disabled:cursor-default disabled:opacity-100"
        >
          <span aria-hidden="true">👤</span>
        </button>
        <Link
          href="/cart"
          aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
          className="relative grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white text-lg"
        >
          <span aria-hidden="true">🛍️</span>
          {cartCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-coral text-[11px] font-bold text-white"
            >
              {cartCount}
            </span>
          )}
        </Link>
      </div>
    </div>
  );
}
