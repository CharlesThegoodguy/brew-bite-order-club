import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Coffee, Minus, Plus, ShoppingBag, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { changeCartQuantity, getCartCount, getCartTotal, type CartLine } from "@/lib/storefront";

import cappuccinoPhoto from "@/assets/cappuccino.jpg";
import croissantPhoto from "@/assets/croissant.jpg";
import icedCoffeePhoto from "@/assets/iced-kopi.jpg";
import snackPhoto from "@/assets/snack.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Menu Kedai Sore — Kopi & Camilan" },
      { name: "description", content: "Pilih kopi segar dan camilan favorit dari Kedai Sore." },
      { property: "og:title", content: "Menu Kedai Sore — Kopi & Camilan" },
      { property: "og:description", content: "Pilih kopi segar dan camilan favorit dari Kedai Sore." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Storefront,
});

type Product = {
  id: string;
  name: string;
  description: string;
  category: "Kopi" | "Camilan";
  price: number;
  photo: string;
  photoClass: string;
};

const products: Product[] = [
  {
    id: "kopi-gula-aren",
    name: "Es Kopi Gula Aren",
    description: "Kopi susu · 1 gelas",
    category: "Kopi",
    price: 22000,
    photo: icedCoffeePhoto,
    photoClass: "product-photo--latte",
  },
  {
    id: "cappuccino",
    name: "Cappuccino",
    description: "Espresso & susu · 1 cangkir",
    category: "Kopi",
    price: 24000,
    photo: cappuccinoPhoto,
    photoClass: "product-photo--cappuccino",
  },
  {
    id: "croissant",
    name: "Croissant Butter",
    description: "Baru dipanggang · 1 pcs",
    category: "Camilan",
    price: 18000,
    photo: croissantPhoto,
    photoClass: "product-photo--croissant",
  },
  {
    id: "brownies-donut",
    name: "Brownies & Donat",
    description: "Manisnya pas · 1 porsi",
    category: "Camilan",
    price: 20000,
    photo: snackPhoto,
    photoClass: "product-photo--snack",
  },
];

const formatRupiah = (amount: number) => `Rp${amount.toLocaleString("id-ID")}`;

function Storefront() {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [category, setCategory] = useState("Semua");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<"cart" | "checkout" | "done">("cart");
  const [customerName, setCustomerName] = useState("");
  const [orderType, setOrderType] = useState<"Ambil di kedai" | "Makan di tempat">("Ambil di kedai");
  const [orderNumber, setOrderNumber] = useState("");

  const visibleProducts = useMemo(
    () => products.filter((product) => category === "Semua" || product.category === category),
    [category],
  );
  const cartCount = getCartCount(cart);
  const cartTotal = getCartTotal(cart, products);

  const closeDialog = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setStep("cart");
    }
  };

  const submitOrder = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customerName.trim() || cartCount === 0) return;
    setOrderNumber(`KS-${Math.floor(1000 + Math.random() * 9000)}`);
    setStep("done");
    setCart([]);
  };

  return (
    <main className="storefront-rays relative min-h-screen overflow-hidden px-4 pb-14 pt-4 sm:px-8 sm:pt-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-cafe-blue-deep/25" />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between">
        <div className="inline-flex items-center gap-2 rounded-lg bg-paper px-3 py-2 text-paper-ink shadow-sm">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Coffee className="size-5" aria-hidden="true" />
          </span>
          <span className="font-display text-lg leading-none">Kedai Sore</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="relative h-12 gap-2 rounded-xl border-2 border-dashed border-paper-ink bg-paper px-4 text-paper-ink shadow-sm hover:bg-secondary"
          onClick={() => setDialogOpen(true)}
          aria-label={`Buka keranjang, ${cartCount} barang`}
        >
          <ShoppingBag className="size-5 text-primary" aria-hidden="true" />
          <span className="font-extrabold tabular-nums">{cartCount}</span>
        </Button>
      </header>

      <section className="relative z-10 mx-auto mt-10 w-full max-w-2xl sm:mt-14" aria-labelledby="menu-title">
        <div className="receipt-paper relative border border-paper-ink/10">
          <div className="absolute -top-6 left-1/2 z-20 flex size-12 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-4 ring-cafe-blue">
            <Coffee className="size-7" aria-hidden="true" />
          </div>
          <div className="storefront-footer absolute -top-1 left-0 right-0 h-2" aria-hidden="true" />

          <div className="flex flex-wrap items-end justify-between gap-3 border-b-4 border-double border-paper-ink px-5 pb-3 pt-6 sm:px-7">
            <div>
              <p className="mb-1 text-[11px] font-extrabold uppercase text-paper-muted">Kopi hangat, hati senang</p>
              <h1 id="menu-title" className="receipt-heading text-5xl font-black leading-none text-primary sm:text-6xl">
                MENU
              </h1>
            </div>
            <div className="text-right text-xs font-bold text-paper-ink">
              <span className="block">Dibuat segar</span>
              <span className="font-display text-lg text-primary">setiap hari</span>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] items-center gap-3 bg-cafe-blue px-4 py-2 text-xs font-black uppercase text-primary-foreground sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:px-6">
            <span>Nama menu</span>
            <span className="hidden sm:block">Harga</span>
            <span className="text-right">Tambah</span>
          </div>

          <div className="flex flex-wrap gap-2 px-5 pb-2 pt-4 sm:px-6" aria-label="Kategori menu">
            {["Semua", "Kopi", "Camilan"].map((item) => (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={category === item ? "default" : "outline"}
                className="h-8 rounded-full px-4 text-xs font-extrabold"
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
              >
                {item}
              </Button>
            ))}
          </div>

          <div className="divide-y-2 divide-border">
            {visibleProducts.map((product) => {
              const quantity = cart.find((line) => line.id === product.id)?.quantity ?? 0;
              return (
                <article key={product.id} className="grid grid-cols-[68px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:grid-cols-[80px_minmax(0,1fr)_auto] sm:gap-4 sm:px-6 sm:py-5">
                  <div className={`product-photo ${product.photoClass} rotate-[-2deg] border-[5px] border-background shadow-md`}>
                    <img src={product.photo} alt={product.name} />
                    <span className="paper-tape absolute -top-1 left-1/2 h-2 w-8 -translate-x-1/2 rotate-2 shadow-sm" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-black text-paper-ink sm:text-base">{product.name}</h2>
                    <p className="mt-1 text-xs text-paper-muted">{product.description}</p>
                    <p className="mt-2 text-xs font-extrabold text-primary sm:hidden">{formatRupiah(product.price)}</p>
                  </div>
                  <div className="flex min-w-[94px] flex-col items-end gap-2">
                    <span className="hidden text-base font-black tabular-nums text-paper-ink sm:block">{formatRupiah(product.price)}</span>
                    <Button
                      type="button"
                      variant="default"
                      size="icon"
                      className="size-10 rounded-full border-b-4 border-primary-foreground/25 p-0 shadow-md"
                      aria-label={`Tambah ${product.name} ke keranjang`}
                      onClick={() => setCart((current) => changeCartQuantity(current, product.id, 1))}
                    >
                      <Plus className="size-5" aria-hidden="true" />
                    </Button>
                    {quantity > 0 && <span className="text-[10px] font-bold text-paper-muted">di keranjang: {quantity}</span>}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="storefront-footer h-2 border-y-2 border-dashed border-paper-ink" aria-hidden="true" />
          <div className="px-5 py-4 text-xs leading-relaxed text-paper-muted sm:px-6">
            <p>Pesan favoritmu, lalu nikmati hari dengan lebih santai.</p>
            <p className="mt-1 font-bold text-paper-ink">Terima kasih sudah mampir ke Kedai Sore!</p>
          </div>
        </div>
      </section>

      <footer className="relative z-10 mx-auto mt-10 text-center text-xs font-bold text-primary-foreground/80">
        Kedai Sore · Kopi & camilan, dibuat dengan hati
      </footer>

      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-h-[88vh] overflow-y-auto border-2 border-paper-ink bg-paper text-paper-ink sm:max-w-md">
          {step === "cart" && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl text-paper-ink">Keranjang belanja</DialogTitle>
                <DialogDescription className="text-paper-muted">
                  {cartCount > 0 ? `${cartCount} menu pilihanmu` : "Belum ada menu di keranjang."}
                </DialogDescription>
              </DialogHeader>
              {cartCount > 0 ? (
                <div className="space-y-3">
                  {cart.map((line) => {
                    const product = products.find((item) => item.id === line.id);
                    if (!product) return null;
                    return (
                      <div key={line.id} className="flex items-center justify-between gap-3 border-b border-border pb-3">
                        <div className="min-w-0">
                          <p className="truncate font-extrabold">{product.name}</p>
                          <p className="text-sm text-paper-muted">{formatRupiah(product.price * line.quantity)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button type="button" variant="outline" size="icon" className="size-8" aria-label={`Kurangi ${product.name}`} onClick={() => setCart((current) => changeCartQuantity(current, line.id, -1))}>
                            <Minus aria-hidden="true" />
                          </Button>
                          <span className="w-5 text-center font-bold tabular-nums">{line.quantity}</span>
                          <Button type="button" variant="outline" size="icon" className="size-8" aria-label={`Tambah ${product.name}`} onClick={() => setCart((current) => changeCartQuantity(current, line.id, 1))}>
                            <Plus aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between pt-1 font-black">
                    <span>Total</span><span className="tabular-nums">{formatRupiah(cartTotal)}</span>
                  </div>
                  <Button type="button" className="w-full font-extrabold" onClick={() => setStep("checkout")}>
                    Lanjut pesan
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-5 text-center">
                  <ShoppingBag className="size-9 text-paper-muted" aria-hidden="true" />
                  <p className="text-sm text-paper-muted">Pilih kopi atau camilan yang kamu suka.</p>
                  <Button type="button" variant="outline" onClick={() => closeDialog(false)}>Lihat menu</Button>
                </div>
              )}
            </>
          )}

          {step === "checkout" && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl text-paper-ink">Detail pesanan</DialogTitle>
                <DialogDescription className="text-paper-muted">Isi nama dan pilih cara menikmati pesananmu.</DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={submitOrder}>
                <div className="space-y-2">
                  <label htmlFor="customer-name" className="text-sm font-bold">Nama</label>
                  <Input id="customer-name" name="name" autoComplete="name" placeholder="Nama kamu" value={customerName} onChange={(event) => setCustomerName(event.target.value)} required />
                </div>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-bold">Pesanan untuk</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {(["Ambil di kedai", "Makan di tempat"] as const).map((option) => (
                      <Button key={option} type="button" variant={orderType === option ? "default" : "outline"} className="h-auto min-h-10 whitespace-normal px-2 text-xs" aria-pressed={orderType === option} onClick={() => setOrderType(option)}>
                        {option}
                      </Button>
                    ))}
                  </div>
                </fieldset>
                <div className="flex items-center justify-between border-t border-border pt-3 font-black">
                  <span>Total</span><span className="tabular-nums">{formatRupiah(cartTotal)}</span>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep("cart")}>
                    Kembali
                  </Button>
                  <Button type="submit" className="flex-1 font-extrabold">
                    Buat pesanan
                  </Button>
                </div>
              </form>
            </>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center gap-3 py-5 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-secondary text-primary"><Check className="size-8" aria-hidden="true" /></span>
              <DialogHeader className="items-center">
                <DialogTitle className="font-display text-2xl text-paper-ink">Pesanan siap, {customerName}!</DialogTitle>
                <DialogDescription className="text-paper-muted">Tunjukkan nomor ini di kedai untuk pesanan {orderType.toLowerCase()}.</DialogDescription>
              </DialogHeader>
              <div className="w-full border-y-2 border-dashed border-paper-ink py-3">
                <p className="text-xs font-bold uppercase text-paper-muted">Nomor pesanan</p>
                <p className="receipt-heading mt-1 text-3xl font-black text-primary">{orderNumber}</p>
              </div>
              <Button type="button" className="w-full font-extrabold" onClick={() => closeDialog(false)}>
                <X className="size-4" aria-hidden="true" /> Selesai
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}