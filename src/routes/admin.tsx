import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getAdminReportRange,
  getOrdersInReportRange,
  getVerifiedPaidOrders,
  getReportDateLabel,
  getReportPeriodLabel,
  summarizeOrderProductsByCategory,
  summarizeVerifiedPaidOrders,
  type AdminOrder,
  type ReportPeriod,
} from "@/lib/admin-reports";
import {
  type OrderItemRow,
  type OrderStatus,
  type PaymentRow,
  type ProductCategory,
  type ProductRow,
} from "@/lib/supabase";
import type { supabaseClient as SupabaseClientValue } from "@/lib/supabase";

type SupabaseClient = typeof SupabaseClientValue;
type Section = "products" | "orders";

const categories: ProductCategory[] = ["Kopi", "Dessert", "Bundling"];
const adminFieldClassName = "bg-card text-card-foreground placeholder:text-muted-foreground";
const adminOutlineButtonClassName =
  "bg-card text-card-foreground hover:bg-muted hover:text-card-foreground";
const orderStatuses: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
];

const formatRupiah = (amount: number) => `Rp${amount.toLocaleString("id-ID")}`;

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(date),
  );

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Bean & Bite" },
      { name: "description", content: "Kelola produk, pesanan, dan pembayaran Bean & Bite." },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<"loading" | "signed-out" | "checking" | "ready">("loading");
  const [section, setSection] = useState<Section>("products");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [orderToDelete, setOrderToDelete] = useState<AdminOrder | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [verifyingPaymentId, setVerifyingPaymentId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("weekly");
  const [exportingReport, setExportingReport] = useState<"excel" | "pdf" | null>(null);
  const [preparedReport, setPreparedReport] = useState<{
    format: "excel" | "pdf";
    url: string;
    fileName: string;
  } | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ProductCategory>("Kopi");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [stock, setStock] = useState("");

  const loadDashboardData = useCallback(async (client: SupabaseClient) => {
    setLoadingData(true);
    setError("");

    const [productsResult, ordersResult, itemsResult, paymentsResult] = await Promise.all([
      client.from("products").select("*").order("created_at", { ascending: false }),
      client.from("orders").select("*").order("created_at", { ascending: false }),
      client.from("order_items").select("*"),
      client.from("payments").select("*").order("transaction_date", { ascending: true }),
    ]);

    const queryError =
      productsResult.error ?? ordersResult.error ?? itemsResult.error ?? paymentsResult.error;
    if (queryError) {
      setError(`Gagal memuat data dashboard: ${queryError.message}`);
      setProducts([]);
      setOrders([]);
      setLoadingData(false);
      return;
    }
    if (!productsResult.data || !ordersResult.data || !itemsResult.data || !paymentsResult.data) {
      setError("Supabase tidak mengembalikan data dashboard.");
      setProducts([]);
      setOrders([]);
      setLoadingData(false);
      return;
    }

    const categoryByProductId = new Map(
      productsResult.data.map((product) => [product.id, product.category]),
    );
    const itemsByOrder = new Map<string, OrderItemRow[]>();
    for (const item of itemsResult.data) {
      const itemWithCategory = {
        ...item,
        product_category:
          item.product_category ??
          (item.product_id ? (categoryByProductId.get(item.product_id) ?? null) : null),
      };
      const current = itemsByOrder.get(item.order_id) ?? [];
      current.push(itemWithCategory);
      itemsByOrder.set(item.order_id, current);
    }

    const paymentsByOrder = new Map<string, PaymentRow[]>();
    for (const payment of paymentsResult.data) {
      const current = paymentsByOrder.get(payment.order_id) ?? [];
      current.push(payment);
      paymentsByOrder.set(payment.order_id, current);
    }

    setProducts(productsResult.data);
    setOrders(
      ordersResult.data.map((order) => ({
        ...order,
        items: itemsByOrder.get(order.id) ?? [],
        payments: paymentsByOrder.get(order.id) ?? [],
      })),
    );
    setLoadingData(false);
  }, []);

  const verifyAdmin = useCallback(
    async (client: SupabaseClient, signedInUser: User) => {
      setStatus("checking");
      setError("");

      const { data, error: roleError } = await client
        .from("admin_users")
        .select("user_id")
        .eq("user_id", signedInUser.id)
        .maybeSingle();

      if (roleError) {
        setError(`Gagal memeriksa role admin: ${roleError.message}`);
        setStatus("signed-out");
        await client.auth.signOut();
        return;
      }

      if (!data) {
        setError("Akun ini belum diberi akses admin.");
        setStatus("signed-out");
        await client.auth.signOut();
        return;
      }

      setUser(signedInUser);
      setStatus("ready");
      await loadDashboardData(client);
    },
    [loadDashboardData],
  );

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    void import("@/lib/supabase")
      .then(async ({ supabaseClient }) => {
        if (!active) return;
        setSupabase(supabaseClient);

        const { data } = supabaseClient.auth.onAuthStateChange((_event, session) => {
          if (!active) return;
          if (!session) {
            setUser(null);
            setStatus("signed-out");
            setProducts([]);
            setOrders([]);
            return;
          }

          setUser(session.user);
          setStatus("checking");
          window.setTimeout(() => {
            if (active) void verifyAdmin(supabaseClient, session.user);
          }, 0);
        });
        unsubscribe = () => data.subscription.unsubscribe();

        const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
        if (!active) return;
        if (sessionError) {
          setError(`Gagal memeriksa sesi: ${sessionError.message}`);
          setStatus("signed-out");
        } else if (sessionData.session) {
          await verifyAdmin(supabaseClient, sessionData.session.user);
        } else {
          setStatus("signed-out");
        }
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Supabase gagal dimuat.");
        setStatus("signed-out");
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [verifyAdmin]);

  useEffect(() => {
    if (!supabase || status !== "ready") return;

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void loadDashboardData(supabase);
      }
    };

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadDashboardData, status, supabase]);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setError("");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) setError(`Login gagal: ${signInError.message}`);
  };

  const signOut = async () => {
    if (!supabase) return;
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(`Logout gagal: ${signOutError.message}`);
  };

  const clearProductForm = () => {
    setEditingProductId(null);
    setProductName("");
    setDescription("");
    setCategory("Kopi");
    setPrice("");
    setImageUrl("");
    setStock("");
  };

  const editProduct = (product: ProductRow) => {
    setEditingProductId(product.id);
    setProductName(product.product_name);
    setDescription(product.description ?? "");
    setCategory(product.category);
    setPrice(String(product.price));
    setImageUrl(product.image_url ?? "");
    setStock(product.stock === null ? "" : String(product.stock));
    setSection("products");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;

    const parsedPrice = Number(price);
    const parsedStock = stock.trim() === "" ? null : Number(stock);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError("Harga harus berupa angka nol atau lebih.");
      return;
    }
    if (parsedStock !== null && (!Number.isInteger(parsedStock) || parsedStock < 0)) {
      setError("Stok harus berupa bilangan bulat nol atau lebih.");
      return;
    }

    setSavingProduct(true);
    setError("");
    setNotice("");
    const productData = {
      product_name: productName.trim(),
      description: description.trim() || null,
      category,
      price: parsedPrice,
      image_url: imageUrl.trim() || null,
      stock: parsedStock,
    };

    const result = editingProductId
      ? await supabase.from("products").update(productData).eq("id", editingProductId)
      : await supabase.from("products").insert({ ...productData, is_active: true });

    if (result.error) {
      setError(`Gagal menyimpan produk: ${result.error.message}`);
      setSavingProduct(false);
      return;
    }

    await loadDashboardData(supabase);
    setNotice(editingProductId ? "Produk berhasil diperbarui." : "Produk berhasil ditambahkan.");
    setSavingProduct(false);
    clearProductForm();
  };

  const toggleProductActive = async (product: ProductRow) => {
    if (!supabase) return;
    setError("");
    setNotice("");

    const { error: updateError } = await supabase
      .from("products")
      .update({ is_active: !product.is_active })
      .eq("id", product.id);

    if (updateError) {
      setError(`Gagal mengubah status produk: ${updateError.message}`);
      return;
    }

    await loadDashboardData(supabase);
    setNotice(`Produk ${product.is_active ? "dinonaktifkan" : "diaktifkan"}.`);
  };

  const updateOrderStatus = async (orderId: string, nextStatus: OrderStatus) => {
    if (!supabase) return;
    setError("");

    const { error: updateError } = await supabase
      .from("orders")
      .update({ order_status: nextStatus })
      .eq("id", orderId);

    if (updateError) {
      setError(`Gagal memperbarui status pesanan: ${updateError.message}`);
      return;
    }

    await loadDashboardData(supabase);
    setNotice("Status pesanan berhasil diperbarui.");
  };

  const deleteOrder = async (order: AdminOrder) => {
    if (!supabase) return;
    setDeletingOrderId(order.id);
    setError("");
    setNotice("");

    const { data, error: deleteError } = await supabase
      .from("orders")
      .delete()
      .eq("id", order.id)
      .select("id")
      .maybeSingle();

    if (deleteError) {
      const needsDatabaseSetup =
        deleteError.code === "42501" ||
        /permission denied|row-level security/i.test(deleteError.message);
      setError(
        needsDatabaseSetup
          ? `Supabase menolak penghapusan. Jalankan ulang supabase/setup.sql di SQL Editor. Detail: ${deleteError.message}`
          : `Gagal menghapus pesanan ${order.order_number}: ${deleteError.message}`,
      );
      setDeletingOrderId(null);
      setOrderToDelete(null);
      return;
    }
    if (!data) {
      setError(
        `Pesanan ${order.order_number} tidak terhapus. Muat ulang data, lalu pastikan supabase/setup.sql sudah dijalankan.`,
      );
      setDeletingOrderId(null);
      setOrderToDelete(null);
      return;
    }

    setOrders((currentOrders) => currentOrders.filter((current) => current.id !== order.id));
    setPreparedReport(null);
    setNotice(`Pesanan ${order.order_number} dan detail terkait berhasil dihapus.`);
    setDeletingOrderId(null);
    setOrderToDelete(null);
  };

  const verifyPayment = async (order: AdminOrder) => {
    if (!supabase || verifyingPaymentId !== null) return;
    setVerifyingPaymentId(order.id);
    setError("");
    const payment = order.payments.at(-1);
    const transactionDate = new Date().toISOString();
    const result = payment
      ? await supabase
          .from("payments")
          .update({
            payment_status: "PAID",
            verified: true,
            transaction_date: transactionDate,
          })
          .eq("id", payment.id)
      : await supabase.from("payments").insert({
          order_id: order.id,
          payment_reference: null,
          payment_method: order.payment_method,
          amount: order.total_amount,
          payment_status: "PAID",
          verified: true,
          transaction_date: transactionDate,
        });

    if (result.error) {
      setError(`Gagal memverifikasi pembayaran: ${result.error.message}`);
      setVerifyingPaymentId(null);
      return;
    }

    await loadDashboardData(supabase);
    setNotice(
      payment
        ? `Pembayaran ${order.order_number} berhasil diverifikasi.`
        : `Pembayaran ${order.order_number} berhasil dicatat dan diverifikasi.`,
    );
    setVerifyingPaymentId(null);
  };

  const reportRange = useMemo(() => getAdminReportRange(reportPeriod), [reportPeriod]);
  const reportOrders = useMemo(
    () => getVerifiedPaidOrders(getOrdersInReportRange(orders, reportRange)),
    [orders, reportRange],
  );
  const reportSummary = useMemo(() => summarizeVerifiedPaidOrders(reportOrders), [reportOrders]);
  const reportCategorySummary = useMemo(
    () => summarizeOrderProductsByCategory(reportOrders),
    [reportOrders],
  );
  const reportPeriodLabel = getReportPeriodLabel(reportPeriod, reportRange);

  useEffect(() => {
    if (!preparedReport) return;
    return () => URL.revokeObjectURL(preparedReport.url);
  }, [preparedReport]);

  const exportReport = async (format: "excel" | "pdf") => {
    setExportingReport(format);
    setPreparedReport(null);
    setError("");
    setNotice("");

    try {
      const { exportAdminReportToExcel, exportAdminReportToPdf } =
        await import("@/lib/admin-report-export");
      const file =
        format === "excel"
          ? await exportAdminReportToExcel(reportOrders, reportPeriod, reportRange)
          : exportAdminReportToPdf(reportOrders, reportPeriod, reportRange);
      setPreparedReport({ format, fileName: file.fileName, url: URL.createObjectURL(file.blob) });
      setNotice("File siap diunduh. Klik tombol unduh untuk menyimpan file.");
    } catch (cause: unknown) {
      const message =
        cause instanceof Error ? cause.message : "Terjadi kesalahan yang tidak diketahui.";
      setError(`Gagal membuat file ${format === "excel" ? "Excel" : "PDF"}: ${message}`);
    } finally {
      setExportingReport(null);
    }
  };

  const isInitializing = status === "loading" || status === "checking";

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
              ← Kembali ke toko
            </Link>
            <h1 className="mt-2 text-3xl font-black">Admin Bean & Bite</h1>
          </div>
          {status === "ready" && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{user?.email}</span>
              <Button variant="outline" className={adminOutlineButtonClassName} onClick={signOut}>
                Keluar
              </Button>
            </div>
          )}
        </header>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"
          >
            {error}
          </div>
        )}
        {notice && (
          <div
            role="status"
            className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm"
          >
            {notice}
          </div>
        )}

        {isInitializing && <p role="status">Memeriksa sesi admin...</p>}

        {!isInitializing && status !== "ready" && (
          <section className="mx-auto max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
            <h2 className="text-xl font-bold">Login admin</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Gunakan akun admin yang sudah diberi role di database.
            </p>
            <form className="mt-6 space-y-4" onSubmit={signIn}>
              <div className="space-y-2">
                <label htmlFor="admin-email" className="text-sm font-semibold">
                  Email
                </label>
                <Input
                  id="admin-email"
                  type="email"
                  className={adminFieldClassName}
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="admin-password" className="text-sm font-semibold">
                  Password
                </label>
                <Input
                  id="admin-password"
                  type="password"
                  className={adminFieldClassName}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={!supabase}>
                Masuk
              </Button>
            </form>
            <p className="mt-4 text-xs text-muted-foreground">
              Pendaftaran admin tidak tersedia di halaman ini.
            </p>
          </section>
        )}

        {status === "ready" && (
          <>
            <nav aria-label="Menu admin" className="flex gap-2 border-b pb-3">
              <Button
                variant={section === "products" ? "default" : "outline"}
                aria-pressed={section === "products"}
                onClick={() => setSection("products")}
              >
                Produk ({products.length})
              </Button>
              <Button
                variant={section === "orders" ? "default" : "outline"}
                aria-pressed={section === "orders"}
                onClick={() => setSection("orders")}
              >
                Pesanan ({orders.length})
              </Button>
              <Button
                variant="outline"
                className={adminOutlineButtonClassName}
                onClick={() => supabase && void loadDashboardData(supabase)}
              >
                Muat ulang
              </Button>
            </nav>

            {loadingData && <p role="status">Memuat data...</p>}

            {section === "products" && (
              <section className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr]">
                <form
                  className="h-fit space-y-4 rounded-xl border bg-card p-5 text-card-foreground"
                  onSubmit={saveProduct}
                >
                  <h2 className="text-lg font-bold">
                    {editingProductId ? "Ubah produk" : "Tambah produk"}
                  </h2>
                  <div className="space-y-2">
                    <label htmlFor="product-name" className="text-sm font-semibold">
                      Nama produk
                    </label>
                    <Input
                      id="product-name"
                      className={adminFieldClassName}
                      value={productName}
                      onChange={(event) => setProductName(event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="product-description" className="text-sm font-semibold">
                      Deskripsi
                    </label>
                    <textarea
                      id="product-description"
                      className={`min-h-20 w-full rounded-md border border-input px-3 py-2 text-sm ${adminFieldClassName}`}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="product-category" className="text-sm font-semibold">
                      Kategori
                    </label>
                    <select
                      id="product-category"
                      className={`h-10 w-full rounded-md border border-input px-3 text-sm ${adminFieldClassName}`}
                      value={category}
                      onChange={(event) => setCategory(event.target.value as ProductCategory)}
                    >
                      {categories.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label htmlFor="product-price" className="text-sm font-semibold">
                        Harga (Rp)
                      </label>
                      <Input
                        id="product-price"
                        type="number"
                        className={adminFieldClassName}
                        min="0"
                        step="1"
                        value={price}
                        onChange={(event) => setPrice(event.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="product-stock" className="text-sm font-semibold">
                        Stok (opsional)
                      </label>
                      <Input
                        id="product-stock"
                        type="number"
                        className={adminFieldClassName}
                        min="0"
                        step="1"
                        value={stock}
                        onChange={(event) => setStock(event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="product-image" className="text-sm font-semibold">
                      URL gambar (opsional)
                    </label>
                    <Input
                      id="product-image"
                      type="url"
                      className={adminFieldClassName}
                      value={imageUrl}
                      onChange={(event) => setImageUrl(event.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={savingProduct}>
                      {savingProduct
                        ? "Menyimpan..."
                        : editingProductId
                          ? "Simpan perubahan"
                          : "Tambah produk"}
                    </Button>
                    {editingProductId && (
                      <Button
                        type="button"
                        variant="outline"
                        className={adminOutlineButtonClassName}
                        onClick={clearProductForm}
                      >
                        Batal
                      </Button>
                    )}
                  </div>
                </form>

                <div className="space-y-3">
                  {products.length === 0 && !loadingData && (
                    <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
                      Belum ada produk. Tambahkan produk melalui formulir.
                    </p>
                  )}
                  {products.map((product) => (
                    <article
                      key={product.id}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4 text-card-foreground"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold">{product.product_name}</h3>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                            {product.category}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${product.is_active ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}`}
                          >
                            {product.is_active ? "Aktif" : "Nonaktif"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm">{formatRupiah(product.price)}</p>
                        {product.stock !== null && (
                          <p className="text-xs text-muted-foreground">Stok: {product.stock}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className={adminOutlineButtonClassName}
                          onClick={() => editProduct(product)}
                        >
                          Ubah
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className={adminOutlineButtonClassName}
                          onClick={() => void toggleProductActive(product)}
                        >
                          {product.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {section === "orders" && (
              <section className="space-y-4">
                <div className="space-y-4 rounded-xl border bg-card p-5 text-card-foreground">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold">Rekap pesanan</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{reportPeriodLabel}</p>
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <Button
                        variant="outline"
                        className={adminOutlineButtonClassName}
                        disabled={loadingData}
                        onClick={() => {
                          if (supabase) void loadDashboardData(supabase);
                        }}
                      >
                        {loadingData ? "Memuat..." : "Muat ulang data"}
                      </Button>
                      <div className="space-y-2">
                        <label htmlFor="report-period" className="text-sm font-semibold">
                          Periode rekap
                        </label>
                        <select
                          id="report-period"
                          className={`h-10 min-w-48 rounded-md border border-input px-3 text-sm ${adminFieldClassName}`}
                          value={reportPeriod}
                          onChange={(event) => {
                            setPreparedReport(null);
                            setReportPeriod(
                              event.target.value === "monthly" ? "monthly" : "weekly",
                            );
                          }}
                        >
                          <option value="weekly">Minggu ini (Senin-Minggu)</option>
                          <option value="monthly">Bulan ini</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                    <div className="rounded-lg border p-3">
                      <dt className="text-sm text-muted-foreground">Pesanan PAID terverifikasi</dt>
                      <dd className="mt-1 font-bold">{reportSummary.orderCount}</dd>
                    </div>
                    <div className="rounded-lg border p-3">
                      <dt className="text-sm text-muted-foreground">Omzet terverifikasi</dt>
                      <dd className="mt-1 font-bold">
                        {formatRupiah(reportSummary.verifiedPaidAmount)}
                      </dd>
                    </div>
                    <div className="rounded-lg border p-3">
                      <dt className="text-sm text-muted-foreground">Kopi terjual</dt>
                      <dd className="mt-1 font-bold">{reportCategorySummary.Kopi} pcs</dd>
                    </div>
                    <div className="rounded-lg border p-3">
                      <dt className="text-sm text-muted-foreground">Dessert terjual</dt>
                      <dd className="mt-1 font-bold">{reportCategorySummary.Dessert} pcs</dd>
                    </div>
                    <div className="rounded-lg border p-3">
                      <dt className="text-sm text-muted-foreground">Bundling terjual</dt>
                      <dd className="mt-1 font-bold">{reportCategorySummary.Bundling} pcs</dd>
                    </div>
                    <div className="rounded-lg border p-3">
                      <dt className="text-sm text-muted-foreground">Jenis tidak diketahui</dt>
                      <dd className="mt-1 font-bold">
                        {reportCategorySummary["Tidak diketahui"]} pcs
                      </dd>
                    </div>
                  </dl>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-muted-foreground">
                      <p>{reportOrders.length} pesanan PAID terverifikasi dalam periode ini.</p>
                      <p>Daftar di bawah tetap menampilkan semua pesanan.</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        disabled={loadingData || exportingReport !== null}
                        onClick={() => void exportReport("excel")}
                      >
                        {exportingReport === "excel" ? "Menyiapkan Excel..." : "Buat Excel"}
                      </Button>
                      <Button
                        variant="outline"
                        className={adminOutlineButtonClassName}
                        disabled={loadingData || exportingReport !== null}
                        onClick={() => void exportReport("pdf")}
                      >
                        {exportingReport === "pdf" ? "Menyiapkan PDF..." : "Buat PDF"}
                      </Button>
                    </div>
                  </div>
                  {preparedReport && (
                    <div className="flex flex-wrap items-center gap-3" role="status">
                      <span className="text-sm text-muted-foreground">
                        {preparedReport.fileName}
                      </span>
                      <Button
                        asChild
                        variant={preparedReport.format === "excel" ? "default" : "outline"}
                        className={
                          preparedReport.format === "pdf" ? adminOutlineButtonClassName : undefined
                        }
                      >
                        <a href={preparedReport.url} download={preparedReport.fileName}>
                          Unduh {preparedReport.format === "excel" ? "Excel" : "PDF"}
                        </a>
                      </Button>
                    </div>
                  )}
                </div>

                {orders.length === 0 && !loadingData && (
                  <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
                    Belum ada pesanan tercatat.
                  </p>
                )}
                {orders.map((order) => {
                  const latestPayment = order.payments.at(-1);
                  return (
                    <article
                      key={order.id}
                      className="space-y-4 rounded-xl border bg-card p-5 text-card-foreground"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h2 className="font-bold">{order.order_number}</h2>
                          <p className="text-sm text-muted-foreground">
                            {order.customer_name} · {order.customer_whatsapp}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(order.created_at)}
                          </p>
                        </div>
                        <strong>{formatRupiah(order.total_amount)}</strong>
                      </div>
                      <ul className="space-y-1 border-y py-3 text-sm">
                        {order.items.length === 0 ? (
                          <li className="text-muted-foreground">
                            Detail produk belum tersimpan untuk pesanan ini.
                          </li>
                        ) : (
                          order.items.map((item) => (
                            <li key={item.id} className="flex justify-between gap-3">
                              <span>
                                {item.product_name} × {item.quantity}
                              </span>
                              <span>{formatRupiah(item.subtotal)}</span>
                            </li>
                          ))
                        )}
                      </ul>
                      {order.notes && (
                        <p className="whitespace-pre-wrap text-sm">Catatan: {order.notes}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="text-sm font-semibold" htmlFor={`status-${order.id}`}>
                          Status pesanan
                        </label>
                        <select
                          id={`status-${order.id}`}
                          className={`h-9 rounded-md border border-input px-2 text-sm ${adminFieldClassName}`}
                          value={order.order_status}
                          onChange={(event) =>
                            void updateOrderStatus(order.id, event.target.value as OrderStatus)
                          }
                        >
                          {orderStatuses.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                        <span className="text-sm">
                          Pembayaran: {order.payment_status}
                          {latestPayment?.verified
                            ? " · terverifikasi"
                            : latestPayment
                              ? " · belum terverifikasi"
                              : " · belum ada catatan pembayaran"}
                        </span>
                        {(order.payment_status !== "PAID" ||
                          (latestPayment &&
                            (latestPayment.payment_status !== "PAID" ||
                              !latestPayment.verified))) && (
                          <Button
                            size="sm"
                            disabled={verifyingPaymentId !== null}
                            onClick={() => void verifyPayment(order)}
                          >
                            {verifyingPaymentId === order.id
                              ? "Memverifikasi..."
                              : latestPayment
                                ? "Verifikasi pembayaran"
                                : "Catat & verifikasi pembayaran"}
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={loadingData || deletingOrderId !== null}
                          onClick={() => setOrderToDelete(order)}
                        >
                          Hapus pesanan
                        </Button>
                      </div>
                    </article>
                  );
                })}
                <AlertDialog
                  open={orderToDelete !== null}
                  onOpenChange={(open) => {
                    if (!open && deletingOrderId === null) setOrderToDelete(null);
                  }}
                >
                  <AlertDialogContent className="bg-card text-card-foreground">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Hapus pesanan?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Pesanan {orderToDelete?.order_number} akan dihapus permanen. Detail produk
                        dan riwayat pembayarannya juga akan dihapus.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel
                        className={adminOutlineButtonClassName}
                        disabled={deletingOrderId !== null}
                      >
                        Batal
                      </AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={deletingOrderId !== null}
                        onClick={(event) => {
                          event.preventDefault();
                          if (orderToDelete) void deleteOrder(orderToDelete);
                        }}
                      >
                        {deletingOrderId ? "Menghapus..." : "Ya, hapus"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
