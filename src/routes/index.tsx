import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Coffee, MessageCircle, Minus, Plus, QrCode, ShoppingBag, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { changeCartQuantity, getCartCount, getCartTotal, type CartLine } from "@/lib/storefront";
import { supabaseClient, type ProductCategory, type ProductRow } from "@/lib/supabase";

import americanoPhoto from "@/KWU asset/americano.png";
import americanoBundlePhoto from "@/KWU asset/americano + dessert.png";
import americanoCranberryPhoto from "@/KWU asset/americano cranberry.png";
import cranberryBundlePhoto from "@/KWU asset/cranberry + dessert.png";
import dessertPhoto from "@/KWU asset/dessert oreo png.png";
import gulaArenBundlePhoto from "@/KWU asset/gula aren + dessert.png";
import gulaArenPhoto from "@/KWU asset/kopi gula aren.png";
import logoPhoto from "@/KWU asset/LOGO PRODUCT PNG.png";
import qrisPhoto from "@/KWU asset/merchan qris.jpeg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Menu Bean & Bite — Kopi & Dessert" },
      {
        name: "description",
        content: "Pilih kopi, dessert Oreo, dan paket bundling favorit dari Bean & Bite.",
      },
      { property: "og:title", content: "Menu Bean & Bite — Kopi & Dessert" },
      {
        property: "og:description",
        content: "Pilih kopi, dessert Oreo, dan paket bundling favorit dari Bean & Bite.",
      },
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
  category: ProductCategory;
  price: number;
  photo: string;
  photoClass: string;
};

const productPresentation: Record<string, { photo: string; photoClass: string }> = {
  "Kopi Americano": { photo: americanoPhoto, photoClass: "product-photo--latte" },
  "Americano Cranberry": {
    photo: americanoCranberryPhoto,
    photoClass: "product-photo--cappuccino",
  },
  "Kopi Susu Gula Aren": { photo: gulaArenPhoto, photoClass: "product-photo--croissant" },
  "Dessert Oreo": { photo: dessertPhoto, photoClass: "product-photo--snack" },
  "Paket SKS": { photo: americanoBundlePhoto, photoClass: "product-photo--latte" },
  "Paket EPRT": { photo: cranberryBundlePhoto, photoClass: "product-photo--cappuccino" },
  "Paket TAK": { photo: gulaArenBundlePhoto, photoClass: "product-photo--croissant" },
};

const productPhotoClassByCategory: Record<ProductCategory, string> = {
  Kopi: "product-photo--latte",
  Dessert: "product-photo--snack",
  Bundling: "product-photo--cappuccino",
};

function mapProduct(row: ProductRow): Product {
  if (!["Kopi", "Dessert", "Bundling"].includes(row.category)) {
    throw new Error(`Kategori produk "${row.product_name}" tidak valid.`);
  }

  const presentation = productPresentation[row.product_name];

  return {
    id: row.id,
    name: row.product_name,
    description: row.description ?? "",
    category: row.category,
    price: Number(row.price),
    photo: row.image_url || presentation?.photo || logoPhoto,
    photoClass: presentation?.photoClass ?? productPhotoClassByCategory[row.category],
  };
}

const formatRupiah = (amount: number) => `Rp${amount.toLocaleString("id-ID")}`;

const whatsappContacts = [
  { name: "CP 1 · ORYZA", number: "6287787870370" },
  { name: "CP 2 · RATU", number: "6281319159786" },
];

const modalOutlineButtonClass = "bg-paper text-paper-ink hover:bg-secondary hover:text-paper-ink";

function Storefront() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [category, setCategory] = useState("Semua");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<"cart" | "added" | "checkout" | "confirm" | "payment">("cart");
  const [recentlyAddedProductId, setRecentlyAddedProductId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [orderError, setOrderError] = useState("");
  const [creatingOrder, setCreatingOrder] = useState(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const { data, error } = await supabaseClient
          .from("products")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true });

        if (!active) return;
        if (error) {
          setProductsError(`Menu gagal dimuat dari Supabase: ${error.message}`);
        } else if (!data) {
          setProductsError("Supabase tidak mengembalikan data menu.");
        } else {
          try {
            setProducts(data.map(mapProduct));
          } catch (cause) {
            setProductsError(cause instanceof Error ? cause.message : "Data menu tidak valid.");
          }
        }
        setProductsLoading(false);
      } catch (cause) {
        if (!active) return;
        setProductsError(
          cause instanceof Error ? cause.message : "Menu gagal dimuat dari Supabase.",
        );
        setProductsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const pickupDateOptions = [
    "23 November 2026",
    "24 November 2026",
    "25 November 2026",
    "26 November 2026",
    "27 November 2026",
  ];

  const visibleProducts = useMemo(
    () => products.filter((product) => category === "Semua" || product.category === category),
    [category, products],
  );
  const cartCount = getCartCount(cart);
  const cartTotal = getCartTotal(cart, products);
  const recentlyAddedProduct = products.find((product) => product.id === recentlyAddedProductId);
  const recentlyAddedQuantity =
    cart.find((line) => line.id === recentlyAddedProductId)?.quantity ?? 0;

  const closeDialog = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setStep("cart");
      setRecentlyAddedProductId(null);
    }
  };

  const addProduct = (product: Product) => {
    setCart((current) => changeCartQuantity(current, product.id, 1));
    setRecentlyAddedProductId(product.id);
    setStep("added");
    setDialogOpen(true);
  };

  const reviewOrder = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customerName.trim() || !customerPhone.trim() || !pickupDate || cartCount === 0) return;
    setOrderError("");
    setStep("confirm");
  };

  const confirmOrder = async () => {
    setCreatingOrder(true);
    setOrderError("");
    const notes = [orderNotes.trim(), pickupDate ? `Tanggal pengambilan: ${pickupDate}` : ""]
      .filter(Boolean)
      .join("\n");
    const { data, error } = await supabaseClient.rpc("create_order", {
      p_customer_name: customerName.trim(),
      p_customer_whatsapp: customerPhone.trim(),
      p_items: cart.map((line) => ({ product_id: line.id, quantity: line.quantity })),
      p_payment_method: "QRIS",
      p_notes: notes || null,
    });
    setCreatingOrder(false);

    if (error) {
      setOrderError(`Pesanan gagal disimpan: ${error.message}`);
      return;
    }

    const createdOrder = data[0];
    if (!createdOrder) {
      setOrderError("Supabase tidak mengembalikan nomor pesanan.");
      return;
    }

    setOrderNumber(createdOrder.order_number);
    setStep("payment");
  };

  const orderSummary = cart.flatMap((line) => {
    const product = products.find((item) => item.id === line.id);
    return product
      ? [`${product.name} x${line.quantity} - ${formatRupiah(product.price * line.quantity)}`]
      : [];
  });
  const whatsappMessage = [
    `Halo Bean & Bite, saya ingin mengirim bukti pembayaran untuk pesanan ${orderNumber}.`,
    `Nama: ${customerName}`,
    `No. WhatsApp: ${customerPhone}`,
    `Tanggal pengambilan: ${pickupDate}`,
    ...orderSummary,
    `Total: ${formatRupiah(cartTotal)}`,
    orderNotes.trim() ? `Catatan: ${orderNotes.trim()}` : "",
    "Saya akan melampirkan bukti pembayaran di chat ini.",
  ]
    .filter(Boolean)
    .join("\n");
  return (
    <main className="storefront-rays relative min-h-screen overflow-hidden px-4 pb-14 pt-4 sm:px-8 sm:pt-6">
      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between">
        <div className="inline-flex items-center gap-2 rounded-lg bg-paper px-3 py-2 text-paper-ink shadow-sm">
          <span className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-paper">
            <img src={logoPhoto} alt="Logo Bean & Bite" className="size-full object-contain" />
          </span>
          <span className="font-display text-lg leading-none">Bean & Bite</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="relative h-12 gap-2 rounded-xl border-2 border-dashed border-paper-ink bg-paper px-4 text-paper-ink shadow-sm hover:bg-secondary"
          onClick={() => {
            setStep("cart");
            setDialogOpen(true);
          }}
          aria-label={`Buka keranjang, ${cartCount} barang`}
        >
          <ShoppingBag className="size-5 text-primary" aria-hidden="true" />
          <span className="font-extrabold tabular-nums">{cartCount}</span>
        </Button>
      </header>

      <div className="relative z-10 mx-auto mt-6 w-full max-w-2xl text-center sm:mt-8">
        <p className="font-display text-3xl font-black text-primary-foreground sm:text-4xl">
          PO BATCH Duaaaaa!!!!
        </p>
      </div>

      <section
        className="relative z-10 mx-auto mt-10 w-full max-w-2xl sm:mt-14"
        aria-labelledby="menu-title"
      >
        <div className="receipt-paper relative border border-paper-ink/10">
          <div className="absolute -top-6 left-1/2 z-20 flex size-12 -translate-x-1/2 items-center justify-center overflow-hidden rounded-full bg-paper shadow-md ring-4 ring-cafe-blue">
            <img src={logoPhoto} alt="" aria-hidden="true" className="size-full object-contain" />
          </div>
          <div
            className="storefront-footer absolute -top-1 left-0 right-0 h-2"
            aria-hidden="true"
          />

          <div className="flex flex-wrap items-end justify-between gap-3 border-b-4 border-double border-paper-ink px-5 pb-3 pt-6 sm:px-7">
            <div>
              <p className="mb-1 text-[11px] font-extrabold uppercase text-paper-muted">
                Kopi Dingin, hati senang
              </p>
              <h1
                id="menu-title"
                className="receipt-heading text-5xl font-black leading-none text-primary sm:text-6xl"
              >
                MENU
              </h1>
            </div>
            <div className="text-right text-xs font-bold text-paper-ink">
              <span className="block">Dibuat dengan tangan semester tua</span>
              <span className="font-display text-lg text-primary">setiap detik</span>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] items-center gap-3 bg-cafe-blue px-4 py-2 text-xs font-black uppercase text-primary-foreground sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:px-6">
            <span>Nama menu</span>
            <span className="hidden sm:block">Harga</span>
            <span className="text-right">Tambah</span>
          </div>

          <div className="flex flex-wrap gap-2 px-5 pb-2 pt-4 sm:px-6" aria-label="Kategori menu">
            {["Semua", "Kopi", "Dessert", "Bundling"].map((item) => (
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
            {productsLoading && (
              <p role="status" className="px-5 py-8 text-center text-sm text-paper-muted">
                Memuat menu...
              </p>
            )}
            {productsError && (
              <p role="alert" className="px-5 py-8 text-center text-sm text-destructive">
                {productsError}
              </p>
            )}
            {!productsLoading && !productsError && visibleProducts.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-paper-muted">
                Belum ada produk aktif di menu.
              </p>
            )}
            {visibleProducts.map((product) => {
              const quantity = cart.find((line) => line.id === product.id)?.quantity ?? 0;
              return (
                <article
                  key={product.id}
                  className="grid grid-cols-[68px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:grid-cols-[80px_minmax(0,1fr)_auto] sm:gap-4 sm:px-6 sm:py-5"
                >
                  <div
                    className={`product-photo ${product.photoClass} rotate-[-2deg] border-[5px] border-background shadow-md`}
                  >
                    <img src={product.photo} alt={product.name} />
                    <span
                      className="paper-tape absolute -top-1 left-1/2 h-2 w-8 -translate-x-1/2 rotate-2 shadow-sm"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-black text-paper-ink sm:text-base">
                      {product.name}
                    </h2>
                    <p className="mt-1 text-xs text-paper-muted">{product.description}</p>
                    <p className="mt-2 text-xs font-extrabold text-primary sm:hidden">
                      {formatRupiah(product.price)}
                    </p>
                  </div>
                  <div className="flex min-w-[94px] flex-col items-end gap-2">
                    <span className="hidden text-base font-black tabular-nums text-paper-ink sm:block">
                      {formatRupiah(product.price)}
                    </span>
                    <div className="flex items-center gap-2">
                      {quantity > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-10 rounded-full border-b-4 border-paper-ink/20 bg-paper p-0 text-paper-ink shadow-md hover:bg-paper/80 hover:text-paper-ink"
                          aria-label={`Kurangi ${product.name} dari menu`}
                          onClick={() =>
                            setCart((current) => changeCartQuantity(current, product.id, -1))
                          }
                        >
                          <Minus className="size-5" aria-hidden="true" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="default"
                        size="icon"
                        className="size-10 rounded-full border-b-4 border-primary-foreground/25 p-0 shadow-md"
                        aria-label={`Tambah ${product.name} ke keranjang`}
                        onClick={() => addProduct(product)}
                      >
                        <Plus className="size-5" aria-hidden="true" />
                      </Button>
                    </div>
                    {quantity > 0 && (
                      <span className="text-[10px] font-bold text-paper-muted">
                        di keranjang: {quantity}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <div
            className="storefront-footer h-2 border-y-2 border-dashed border-paper-ink"
            aria-hidden="true"
          />
          <div className="px-5 py-4 text-xs leading-relaxed text-paper-muted sm:px-6">
            <p>Pesan favoritmu, lalu nikmati hari dengan lebih santai.</p>
            <p className="mt-1 font-bold text-paper-ink">
              Terima kasih sudah mampir ke Bean & Bite!
            </p>
          </div>
        </div>
      </section>

      <footer className="relative z-10 mx-auto mt-10 text-center text-xs font-bold text-primary-foreground/80">
        Bean & Bite · Kopi & dessert, dibuat dengan hati
        <Link to="/admin" className="ml-3 underline underline-offset-2">
          Admin
        </Link>
      </footer>

      {cartCount > 0 && (
        <aside
          aria-label="Ringkasan pesanan"
          className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-xl border-2 border-paper-ink bg-paper px-4 py-3 text-paper-ink shadow-xl"
        >
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-paper-muted">
              {cartCount} item di pesanan
            </p>
            <p className="font-black tabular-nums">Total {formatRupiah(cartTotal)}</p>
          </div>
          <Button
            type="button"
            className="shrink-0 font-extrabold"
            onClick={() => {
              setStep("cart");
              setDialogOpen(true);
            }}
          >
            <ShoppingBag aria-hidden="true" />
            Pesan ke keranjang
          </Button>
        </aside>
      )}

      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-h-[88vh] overflow-y-auto border-2 border-paper-ink bg-paper text-paper-ink sm:max-w-md">
          {step === "added" && recentlyAddedProduct && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl text-paper-ink">
                  Ditambahkan ke pesanan
                </DialogTitle>
                <DialogDescription className="text-paper-muted">
                  Produk berhasil masuk ke keranjang.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-4 rounded-lg border border-border bg-paper/70 p-3">
                <div
                  className={`product-photo ${recentlyAddedProduct.photoClass} size-20 shrink-0 rounded-lg border border-border`}
                >
                  <img src={recentlyAddedProduct.photo} alt={recentlyAddedProduct.name} />
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold">{recentlyAddedProduct.name}</p>
                  <p className="text-sm text-paper-muted">
                    {recentlyAddedQuantity > 0
                      ? "Jumlah di keranjang"
                      : "Produk dihapus dari keranjang"}
                  </p>
                  <p className="mt-1 text-sm font-bold">
                    {formatRupiah(recentlyAddedProduct.price * recentlyAddedQuantity)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8 bg-paper text-paper-ink hover:bg-secondary hover:text-paper-ink"
                    aria-label={`Kurangi ${recentlyAddedProduct.name}`}
                    disabled={recentlyAddedQuantity === 0}
                    onClick={() =>
                      setCart((current) => changeCartQuantity(current, recentlyAddedProduct.id, -1))
                    }
                  >
                    <Minus aria-hidden="true" />
                  </Button>
                  <span className="w-5 text-center font-bold tabular-nums">
                    {recentlyAddedQuantity}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    className="size-8"
                    aria-label={`Tambah ${recentlyAddedProduct.name}`}
                    onClick={() =>
                      setCart((current) => changeCartQuantity(current, recentlyAddedProduct.id, 1))
                    }
                  >
                    <Plus aria-hidden="true" />
                  </Button>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className={`w-full ${modalOutlineButtonClass}`}
                onClick={() => closeDialog(false)}
              >
                Lanjut pilih menu
              </Button>
            </div>
          )}

          {step === "cart" && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl text-paper-ink">
                  Keranjang belanja
                </DialogTitle>
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
                      <div
                        key={line.id}
                        className="flex items-center justify-between gap-3 border-b border-border pb-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-extrabold">{product.name}</p>
                          <p className="text-sm text-paper-muted">
                            {formatRupiah(product.price * line.quantity)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-8 bg-paper text-paper-ink hover:bg-paper/80 hover:text-paper-ink"
                            aria-label={`Kurangi ${product.name}`}
                            onClick={() =>
                              setCart((current) => changeCartQuantity(current, line.id, -1))
                            }
                          >
                            <Minus aria-hidden="true" />
                          </Button>
                          <span className="w-5 text-center font-bold tabular-nums">
                            {line.quantity}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-8 bg-paper text-paper-ink hover:bg-paper/80 hover:text-paper-ink"
                            aria-label={`Tambah ${product.name}`}
                            onClick={() =>
                              setCart((current) => changeCartQuantity(current, line.id, 1))
                            }
                          >
                            <Plus aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between pt-1 font-black">
                    <span>Total</span>
                    <span className="tabular-nums">{formatRupiah(cartTotal)}</span>
                  </div>
                  <Button
                    type="button"
                    className="w-full font-extrabold"
                    onClick={() => setStep("checkout")}
                  >
                    Lanjut pesan
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-5 text-center">
                  <ShoppingBag className="size-9 text-paper-muted" aria-hidden="true" />
                  <p className="text-sm text-paper-muted">
                    Pilih kopi, dessert, atau paket bundling yang kamu suka.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className={modalOutlineButtonClass}
                    onClick={() => closeDialog(false)}
                  >
                    Lihat menu
                  </Button>
                </div>
              )}
            </>
          )}

          {step === "checkout" && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl text-paper-ink">
                  Detail pesanan
                </DialogTitle>
                <DialogDescription className="text-paper-muted">
                  Isi data pemesan dan pilih pembayaran QRIS.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={reviewOrder}>
                <div className="space-y-2">
                  <label htmlFor="customer-name" className="text-sm font-bold">
                    Nama
                  </label>
                  <Input
                    id="customer-name"
                    name="name"
                    autoComplete="name"
                    placeholder="Nama kamu"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="customer-phone" className="text-sm font-bold">
                    No. WhatsApp
                  </label>
                  <Input
                    id="customer-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="Contoh: 081234567890"
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="pickup-date" className="text-sm font-bold">
                    Tanggal pengambilan
                  </label>
                  <select
                    id="pickup-date"
                    name="pickup-date"
                    value={pickupDate}
                    onChange={(event) => setPickupDate(event.target.value)}
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  >
                    <option value="" disabled>
                      Pilih tanggal pengambilan
                    </option>
                    {pickupDateOptions.map((date) => (
                      <option key={date} value={date}>
                        {date}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="order-notes" className="text-sm font-bold">
                    Catatan <span className="font-normal text-paper-muted">(opsional)</span>
                  </label>
                  <Textarea
                    id="order-notes"
                    name="notes"
                    placeholder="Contoh: tanpa sedotan"
                    value={orderNotes}
                    onChange={(event) => setOrderNotes(event.target.value)}
                    rows={3}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border bg-paper/70 px-3 py-2">
                  <span className="flex items-center gap-2 text-sm font-bold">
                    <QrCode aria-hidden="true" /> Metode pembayaran
                  </span>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-extrabold text-secondary-foreground">
                    QRIS
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3 font-black">
                  <span>Total</span>
                  <span className="tabular-nums">{formatRupiah(cartTotal)}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className={`flex-1 ${modalOutlineButtonClass}`}
                    onClick={() => setStep("cart")}
                  >
                    Kembali
                  </Button>
                  <Button type="submit" className="flex-1 font-extrabold">
                    Pesan sekarang
                  </Button>
                </div>
              </form>
            </>
          )}

          {step === "confirm" && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl text-paper-ink">
                  Konfirmasi pesanan
                </DialogTitle>
                <DialogDescription className="text-paper-muted">
                  Apakah pesanan sudah sesuai dan data kamu benar?
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 rounded-lg border border-border bg-paper/70 p-3 text-sm">
                <div className="space-y-2 border-b border-border pb-3">
                  {cart.map((line) => {
                    const product = products.find((item) => item.id === line.id);
                    if (!product) return null;
                    return (
                      <div key={line.id} className="flex justify-between gap-3">
                        <span>
                          {product.name} x{line.quantity}
                        </span>
                        <span className="shrink-0 font-bold">
                          {formatRupiah(product.price * line.quantity)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p>
                  <span className="font-bold">Nama:</span> {customerName}
                </p>
                <p>
                  <span className="font-bold">No. WhatsApp:</span> {customerPhone}
                </p>
                <p>
                  <span className="font-bold">Tanggal pengambilan:</span> {pickupDate}
                </p>
                {orderNotes.trim() && (
                  <p className="whitespace-pre-wrap">
                    <span className="font-bold">Catatan:</span> {orderNotes}
                  </p>
                )}
                <div className="flex justify-between border-t border-border pt-2 font-black">
                  <span>Total · QRIS</span>
                  <span>{formatRupiah(cartTotal)}</span>
                </div>
              </div>
              {orderError && (
                <p role="alert" className="text-sm text-destructive">
                  {orderError}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className={`flex-1 ${modalOutlineButtonClass}`}
                  onClick={() => setStep("checkout")}
                >
                  Kembali, edit data
                </Button>
                <Button
                  type="button"
                  className="flex-1 font-extrabold"
                  onClick={() => void confirmOrder()}
                  disabled={creatingOrder}
                >
                  <Check aria-hidden="true" /> {creatingOrder ? "Menyimpan..." : "Ya, pesan"}
                </Button>
              </div>
            </div>
          )}

          {step === "payment" && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl text-paper-ink">
                  Pembayaran QRIS
                </DialogTitle>
                <DialogDescription className="text-paper-muted">
                  Pesanan {orderNumber} · atas nama {customerName}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-paper p-3 text-center">
                <img
                  src={qrisPhoto}
                  alt="QRIS resmi Bean & Bite"
                  className="max-h-72 w-auto max-w-full rounded-md object-contain"
                />
                <p className="text-xs leading-relaxed text-paper-muted">
                  Scan QRIS Bean & Bite dan bayar sesuai nominal di bawah.
                </p>
              </div>
              <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
                {cart.map((line) => {
                  const product = products.find((item) => item.id === line.id);
                  if (!product) return null;
                  return (
                    <div key={line.id} className="flex justify-between gap-3">
                      <span>
                        {product.name} x{line.quantity}
                      </span>
                      <span className="shrink-0 font-bold">
                        {formatRupiah(product.price * line.quantity)}
                      </span>
                    </div>
                  );
                })}
                <p className="border-t border-border pt-2 text-paper-muted">
                  Tanggal pengambilan: {pickupDate}
                </p>
                {orderNotes.trim() && (
                  <p className="border-t border-border pt-2 text-paper-muted">
                    Catatan: {orderNotes}
                  </p>
                )}
                <div className="flex justify-between border-t border-border pt-2 text-base font-black">
                  <span>Total pembayaran</span>
                  <span>{formatRupiah(cartTotal)}</span>
                </div>
              </div>
              <div className="space-y-2">
                {whatsappContacts.map((contact) => (
                  <Button
                    key={contact.number}
                    asChild
                    className="payment-contact-button w-full font-extrabold"
                  >
                    <a
                      href={`https://wa.me/${contact.number}?text=${encodeURIComponent(whatsappMessage)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle aria-hidden="true" />
                      Kirim bukti pembayaran · {contact.name}
                    </a>
                  </Button>
                ))}
              </div>
              <p className="text-center text-xs text-paper-muted">
                Pilih kontak WhatsApp untuk mengirim ringkasan pesanan, lalu lampirkan bukti
                pembayaran di chat.
              </p>
              <Button
                type="button"
                variant="outline"
                className={`w-full ${modalOutlineButtonClass}`}
                onClick={() => closeDialog(false)}
              >
                <X aria-hidden="true" /> Tutup
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
