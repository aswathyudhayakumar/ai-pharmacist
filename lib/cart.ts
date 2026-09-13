import { cookies } from "next/headers";
import { getDrugBySalt } from "@/lib/kb";

const CART_COOKIE = "cart_items";

export interface CartLine {
  salt: string;
  qty: number;
}

export interface ResolvedCartLine extends CartLine {
  brand?: string;
  class: string;
  unitPriceInr: number;
  lineTotalInr: number;
}

async function readCart(): Promise<CartLine[]> {
  const store = await cookies();
  const raw = store.get(CART_COOKIE)?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // malformed cookie — treat as empty
  }
  return [];
}

async function writeCart(lines: CartLine[]): Promise<void> {
  const store = await cookies();
  store.set(CART_COOKIE, JSON.stringify(lines), { path: "/", sameSite: "lax" });
}

export async function getCart(): Promise<ResolvedCartLine[]> {
  const lines = await readCart();
  const resolved: ResolvedCartLine[] = [];
  for (const line of lines) {
    const drug = getDrugBySalt(line.salt);
    if (!drug) continue;
    resolved.push({
      ...line,
      brand: drug.brand,
      class: drug.class,
      unitPriceInr: drug.brandPriceInr,
      lineTotalInr: drug.brandPriceInr * line.qty,
    });
  }
  return resolved;
}

export async function getCartCount(): Promise<number> {
  const lines = await readCart();
  return lines.reduce((sum, l) => sum + l.qty, 0);
}

export async function addToCart(salt: string): Promise<void> {
  const lines = await readCart();
  const existing = lines.find((l) => l.salt === salt);
  if (existing) existing.qty += 1;
  else lines.push({ salt, qty: 1 });
  await writeCart(lines);
}

export async function setQty(salt: string, qty: number): Promise<void> {
  const lines = await readCart();
  const next = qty <= 0 ? lines.filter((l) => l.salt !== salt) : lines.map((l) => (l.salt === salt ? { ...l, qty } : l));
  await writeCart(next);
}

export async function removeFromCart(salt: string): Promise<void> {
  await setQty(salt, 0);
}
