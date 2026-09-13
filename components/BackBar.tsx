import Link from "next/link";

export function BackBar({
  title,
  backHref = "/",
  cartCount = 0,
  showSearch = true,
}: {
  title: string;
  backHref?: string;
  cartCount?: number;
  showSearch?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Link href={backHref} aria-label="Go back" className="grid h-11 w-11 place-items-center rounded-full bg-black/5 text-lg">
        <span aria-hidden="true">←</span>
      </Link>
      <h1 className="flex-1 truncate text-lg font-semibold text-ink">{title}</h1>
      {showSearch && (
        <Link href="/search" aria-label="Search medicines" className="grid h-11 w-11 place-items-center rounded-full bg-black/5 text-lg">
          <span aria-hidden="true">🔍</span>
        </Link>
      )}
      <Link
        href="/cart"
        aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
        className="relative grid h-11 w-11 place-items-center rounded-full bg-black/5 text-lg"
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
  );
}
