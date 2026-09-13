import Link from "next/link";

const TABS = [
  { label: "For You", icon: "📋", href: null },
  { label: "Pharmacy", icon: "💊", href: "/" },
  { label: "Labs", icon: "🧪", href: null },
  { label: "Consults", icon: "🩺", href: null },
  { label: "Insurance", icon: "🛡️", href: null },
  { label: "Vaccines", icon: "💉", href: null },
] as const;

export function CategoryTabs({ active = "Pharmacy" }: { active?: string }) {
  return (
    <nav aria-label="Sections" className="border-b border-black/5">
      <ul className="flex gap-1 overflow-x-auto px-2">
        {TABS.map((tab) => {
          const isActive = tab.label === active;
          const content = (
            <span className="flex flex-col items-center gap-1 px-3 py-2 text-xs font-medium">
              <span className="text-2xl" aria-hidden="true">
                {tab.icon}
              </span>
              {tab.label}
            </span>
          );
          return (
            <li key={tab.label} className={`shrink-0 ${isActive ? "border-b-2 border-ink" : ""}`}>
              {tab.href ? (
                <Link
                  href={tab.href}
                  aria-current={isActive ? "page" : undefined}
                  className={isActive ? "block text-ink" : "block text-ink/70"}
                >
                  {content}
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  aria-label={`${tab.label} — not available in this prototype`}
                  className="block text-ink/30 disabled:cursor-default"
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
