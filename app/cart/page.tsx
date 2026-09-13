import Link from "next/link";
import { BackBar } from "@/components/BackBar";
import { Card, PrimaryButton } from "@/components/ui";
import { getCart } from "@/lib/cart";
import { changeQtyAction, removeFromCartAction } from "@/lib/cart-actions";

export default async function CartPage() {
  const items = await getCart();
  const subtotal = items.reduce((sum, i) => sum + i.lineTotalInr, 0);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-page">
      <header className="border-b border-black/5 bg-white">
        <BackBar title="Cart" showSearch={false} />
      </header>
      <main id="main-content" className="flex-1 space-y-4 px-4 py-4">
        {items.length === 0 ? (
          <Card className="space-y-3 p-6 text-center">
            <p className="text-ink/70">Your cart is empty.</p>
            <Link href="/search" className="font-semibold text-coral">
              Browse medicines
            </Link>
          </Card>
        ) : (
          <>
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item.salt}>
                  <Card className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-semibold text-ink">{item.salt}</p>
                      <p className="text-xs text-ink/60">{item.class}</p>
                      <p className="text-sm font-semibold text-ink">₹{item.lineTotalInr}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <form action={changeQtyAction}>
                        <input type="hidden" name="salt" value={item.salt} />
                        <input type="hidden" name="qty" value={item.qty - 1} />
                        <button
                          type="submit"
                          aria-label={`Decrease quantity of ${item.salt}`}
                          className="grid h-9 w-9 place-items-center rounded-full border border-black/10 font-bold"
                        >
                          −
                        </button>
                      </form>
                      <span aria-hidden="true" className="w-4 text-center font-medium">
                        {item.qty}
                      </span>
                      <form action={changeQtyAction}>
                        <input type="hidden" name="salt" value={item.salt} />
                        <input type="hidden" name="qty" value={item.qty + 1} />
                        <button
                          type="submit"
                          aria-label={`Increase quantity of ${item.salt}`}
                          className="grid h-9 w-9 place-items-center rounded-full border border-black/10 font-bold"
                        >
                          +
                        </button>
                      </form>
                      <form action={removeFromCartAction}>
                        <input type="hidden" name="salt" value={item.salt} />
                        <button type="submit" aria-label={`Remove ${item.salt} from cart`} className="text-xs font-semibold text-coral">
                          Remove
                        </button>
                      </form>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
            <Card className="space-y-2 p-4">
              <div className="flex justify-between text-sm text-ink/70">
                <span>Subtotal</span>
                <span>₹{subtotal}</span>
              </div>
              <div className="flex justify-between font-semibold text-ink">
                <span>To be paid</span>
                <span>₹{subtotal}</span>
              </div>
            </Card>
            <PrimaryButton
              type="button"
              disabled
              className="w-full"
              aria-label="Continue to select address — checkout is mocked in this prototype"
            >
              Continue to select address
            </PrimaryButton>
          </>
        )}
      </main>
    </div>
  );
}
