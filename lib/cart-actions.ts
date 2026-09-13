"use server";

import { revalidatePath } from "next/cache";
import { addToCart, removeFromCart, setQty } from "@/lib/cart";

export async function addToCartAction(formData: FormData) {
  const salt = formData.get("salt");
  if (typeof salt !== "string" || !salt) return;
  await addToCart(salt);
  revalidatePath("/cart");
}

export async function changeQtyAction(formData: FormData) {
  const salt = formData.get("salt");
  const qty = Number(formData.get("qty"));
  if (typeof salt !== "string" || !salt || Number.isNaN(qty)) return;
  await setQty(salt, qty);
  revalidatePath("/cart");
}

export async function removeFromCartAction(formData: FormData) {
  const salt = formData.get("salt");
  if (typeof salt !== "string" || !salt) return;
  await removeFromCart(salt);
  revalidatePath("/cart");
}
