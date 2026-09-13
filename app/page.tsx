import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { CategoryTabs } from "@/components/CategoryTabs";
import { PatientSwitcher } from "@/components/PatientSwitcher";
import { Card } from "@/components/ui";
import { getActivePatientId } from "@/lib/session";
import { getCartCount } from "@/lib/cart";

const CATEGORIES = [
  { label: "Pain Relief", icon: "💊" },
  { label: "Skin Care", icon: "🧴" },
  { label: "Elderly Care", icon: "🦯" },
  { label: "Women Care", icon: "🌸" },
  { label: "Men Care", icon: "🧔" },
  { label: "Gut Care", icon: "🍵" },
  { label: "Ayurvedic Wellness", icon: "🌿" },
  { label: "Food & Nutrition", icon: "🥗" },
];

export default async function HomePage() {
  const activePatientId = await getActivePatientId();
  const cartCount = await getCartCount();

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-page">
      <header>
        <TopBar cartCount={cartCount} />
        <CategoryTabs active="Pharmacy" />
      </header>
      <PatientSwitcher activeId={activePatientId} />
      <main id="main-content" className="flex-1 space-y-5 px-4 py-4">
        <div className="flex items-center gap-2">
          <Link
            href="/search"
            aria-label="Search medicines. Opens the search page."
            className="flex min-h-11 flex-1 items-center gap-3 rounded-pill border border-black/10 bg-white px-4 py-3 text-ink/60"
          >
            <span aria-hidden="true">🔍</span>
            <span>Search paracetamol</span>
          </Link>
          <Link
            href="/search"
            className="flex min-h-11 items-center gap-1.5 rounded-pill bg-ink px-4 py-3 font-medium text-white"
          >
            Categories <span aria-hidden="true">▤</span>
          </Link>
        </div>

        <Link
          href="/prescription/upload"
          className="flex min-h-11 items-center justify-between rounded-card border-2 border-dashed border-coral bg-coral-50 px-4 py-4"
        >
          <span className="flex items-center gap-3 font-semibold text-ink">
            <span aria-hidden="true" className="text-2xl">
              📄
            </span>
            Upload prescription
          </span>
          <span aria-hidden="true" className="text-coral">
            →
          </span>
        </Link>

        <Card className="p-4">
          <h2 className="sr-only">Shop by category</h2>
          <ul className="grid grid-cols-4 gap-4">
            {CATEGORIES.map((c) => (
              <li key={c.label}>
                <Link href="/search" className="flex flex-col items-center gap-1.5 text-center text-xs font-medium text-ink">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-coral-50 text-2xl" aria-hidden="true">
                    {c.icon}
                  </span>
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex min-h-11 items-center justify-between rounded-card bg-violet-100 px-4 py-3 text-sm font-medium text-ink">
          <span className="flex items-center gap-2">
            <span aria-hidden="true">⚡</span>
            Delivery in a flash — medicines in under 60 minutes.
          </span>
          <span aria-hidden="true">→</span>
        </div>

        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-sky-100 to-blue-200 p-5 text-center">
            <p className="text-xl font-extrabold text-blue-900">Health Essentials</p>
            <p className="text-sm font-semibold text-amber-700">Up to 45% off on Tata 1mg Healthcare Products</p>
          </div>
        </Card>
      </main>
    </div>
  );
}
