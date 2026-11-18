import { describe, expect, it } from "vitest";

import {
  formatOrderProductDetails,
  getAdminReportRange,
  getOrdersInReportRange,
  getVerifiedPaidOrders,
  isVerifiedPaidOrder,
  summarizeOrderProductsByCategory,
  summarizeVerifiedPaidOrders,
} from "@/lib/admin-reports";

describe("admin order reports", () => {
  it("uses Monday through Sunday for the weekly range", () => {
    const range = getAdminReportRange("weekly", new Date(2026, 10, 18, 12));

    expect(range.start).toEqual(new Date(2026, 10, 16));
    expect(range.endExclusive).toEqual(new Date(2026, 10, 23));
  });

  it("includes the range start and excludes the next period", () => {
    const range = getAdminReportRange("monthly", new Date(2026, 11, 12));
    const orders = [
      { created_at: "2026-12-01T00:00:00" },
      { created_at: "2026-12-31T23:59:59" },
      { created_at: "2027-01-01T00:00:00" },
      { created_at: "not-a-date" },
    ];

    expect(getOrdersInReportRange(orders, range)).toEqual(orders.slice(0, 2));
  });

  it("includes only orders with a verified paid payment", () => {
    expect(
      isVerifiedPaidOrder({
        payments: [
          { payment_status: "PENDING", verified: false },
          { payment_status: "PAID", verified: true },
        ],
      }),
    ).toBe(true);
    expect(isVerifiedPaidOrder({ payments: [{ payment_status: "PAID", verified: false }] })).toBe(
      false,
    );
    expect(isVerifiedPaidOrder({ payments: [{ payment_status: "PENDING", verified: true }] })).toBe(
      false,
    );
  });

  it("filters pending and unverified orders from recap results", () => {
    const orders = [
      { order_number: "PENDING", payments: [{ payment_status: "PENDING", verified: false }] },
      { order_number: "UNVERIFIED", payments: [{ payment_status: "PAID", verified: false }] },
      { order_number: "VERIFIED", payments: [{ payment_status: "PAID", verified: true }] },
    ] as const;

    expect(getVerifiedPaidOrders(orders)).toEqual([orders[2]]);
  });

  it("summarizes only the verified paid orders passed to the report", () => {
    const summary = summarizeVerifiedPaidOrders([{ total_amount: 100 }, { total_amount: 25 }]);

    expect(summary).toEqual({
      orderCount: 2,
      verifiedPaidAmount: 125,
    });
  });

  it("shows product names and quantities, or a clear message when no items exist", () => {
    expect(
      formatOrderProductDetails([
        { product_category: "Kopi", product_name: "Kopi Susu", quantity: 2 },
        { product_category: "Dessert", product_name: "Dessert Oreo", quantity: 1 },
      ]),
    ).toBe("Kopi: Kopi Susu x 2; Dessert: Dessert Oreo x 1");
    expect(formatOrderProductDetails([])).toBe("Detail produk belum tersedia");
  });

  it("totals item quantities by category", () => {
    const summary = summarizeOrderProductsByCategory([
      {
        items: [
          { product_category: "Kopi", quantity: 2 },
          { product_category: "Kopi", quantity: 4 },
          { product_category: "Dessert", quantity: 7 },
          { product_category: "Bundling", quantity: 2 },
          { product_category: null, quantity: 1 },
        ],
      },
    ]);

    expect(summary).toEqual({
      Kopi: 6,
      Dessert: 7,
      Bundling: 2,
      "Tidak diketahui": 1,
    });
  });
});
