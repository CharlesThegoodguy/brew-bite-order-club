import type { OrderItemRow, OrderRow, PaymentRow, ProductCategory } from "@/lib/supabase";

export type AdminOrder = OrderRow & { items: OrderItemRow[]; payments: PaymentRow[] };
export type ReportPeriod = "weekly" | "monthly";
export type ReportDateRange = { start: Date; endExclusive: Date };

export type AdminReportSummary = {
  orderCount: number;
  verifiedPaidAmount: number;
};

export type ProductQuantitySummary = Record<ProductCategory | "Tidak diketahui", number>;

export function getAdminReportRange(
  period: ReportPeriod,
  currentDate = new Date(),
): ReportDateRange {
  const start = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    period === "monthly" ? 1 : currentDate.getDate(),
  );
  if (period === "weekly") {
    const daysSinceMonday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - daysSinceMonday);
  }

  const endExclusive = new Date(start);
  if (period === "weekly") {
    endExclusive.setDate(endExclusive.getDate() + 7);
  } else {
    endExclusive.setMonth(endExclusive.getMonth() + 1);
  }

  return { start, endExclusive };
}

export function getOrdersInReportRange<T extends { created_at: string }>(
  orders: readonly T[],
  range: ReportDateRange,
): T[] {
  const startTime = range.start.getTime();
  const endTime = range.endExclusive.getTime();

  return orders.filter((order) => {
    const createdAt = new Date(order.created_at).getTime();
    return Number.isFinite(createdAt) && createdAt >= startTime && createdAt < endTime;
  });
}

export function formatOrderProductDetails(
  items: readonly Pick<OrderItemRow, "product_category" | "product_name" | "quantity">[],
  separator = "; ",
): string {
  if (items.length === 0) return "Detail produk belum tersedia";
  return items
    .map(
      (item) =>
        `${item.product_category ? `${item.product_category}: ` : ""}${item.product_name} x ${item.quantity}`,
    )
    .join(separator);
}

export function summarizeOrderProductsByCategory(
  orders: readonly {
    items: readonly Pick<OrderItemRow, "product_category" | "quantity">[];
  }[],
): ProductQuantitySummary {
  const summary: ProductQuantitySummary = {
    Kopi: 0,
    Dessert: 0,
    Bundling: 0,
    "Tidak diketahui": 0,
  };

  for (const order of orders) {
    for (const item of order.items) {
      if (
        item.product_category === "Kopi" ||
        item.product_category === "Dessert" ||
        item.product_category === "Bundling"
      ) {
        summary[item.product_category] += item.quantity;
      } else {
        summary["Tidak diketahui"] += item.quantity;
      }
    }
  }

  return summary;
}

export function isVerifiedPaidOrder(order: {
  payments: readonly Pick<PaymentRow, "payment_status" | "verified">[];
}): boolean {
  return order.payments.some((payment) => payment.payment_status === "PAID" && payment.verified);
}

export function getVerifiedPaidOrders<
  T extends { payments: readonly Pick<PaymentRow, "payment_status" | "verified">[] },
>(orders: readonly T[]): T[] {
  return orders.filter(isVerifiedPaidOrder);
}

export function summarizeVerifiedPaidOrders(
  orders: readonly Pick<AdminOrder, "total_amount">[],
): AdminReportSummary {
  return orders.reduce<AdminReportSummary>(
    (summary, order) => {
      summary.orderCount += 1;
      summary.verifiedPaidAmount += order.total_amount;
      return summary;
    },
    {
      orderCount: 0,
      verifiedPaidAmount: 0,
    },
  );
}

export function formatReportDate(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(date);
}

export function getReportDateLabel(range: ReportDateRange): string {
  const endInclusive = new Date(range.endExclusive);
  endInclusive.setDate(endInclusive.getDate() - 1);
  return `${formatReportDate(range.start)} - ${formatReportDate(endInclusive)}`;
}

export function getReportPeriodLabel(period: ReportPeriod, range: ReportDateRange): string {
  return `${period === "weekly" ? "Mingguan" : "Bulanan"} (${getReportDateLabel(range)})`;
}

export function getReportFileName(
  period: ReportPeriod,
  range: ReportDateRange,
  extension: "xlsx" | "pdf",
): string {
  const endInclusive = new Date(range.endExclusive);
  endInclusive.setDate(endInclusive.getDate() - 1);
  const toDateStamp = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  return `bean-bite-rekap-${period}-${toDateStamp(range.start)}-${toDateStamp(endInclusive)}.${extension}`;
}
