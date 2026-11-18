import { describe, expect, it } from "vitest";

import { exportAdminReportToExcel } from "@/lib/admin-report-export";
import type { AdminOrder, ReportDateRange } from "@/lib/admin-reports";
import type { PaymentRow } from "@/lib/supabase";

const range: ReportDateRange = {
  start: new Date(2026, 0, 1),
  endExclusive: new Date(2026, 1, 1),
};

const verifiedPayment: PaymentRow = {
  id: "payment-1",
  order_id: "verified-order",
  payment_reference: null,
  payment_method: "QRIS",
  amount: 25000,
  payment_status: "PAID",
  transaction_date: "2026-01-15T10:01:00.000Z",
  verified: true,
  created_at: "2026-01-15T10:01:00.000Z",
};

const verifiedOrder: AdminOrder = {
  id: "verified-order",
  order_number: "BB-2026-001",
  customer_name: "Customer",
  customer_whatsapp: "08123456789",
  total_amount: 25000,
  order_status: "COMPLETED",
  payment_status: "PAID",
  payment_method: "QRIS",
  notes: null,
  created_at: "2026-01-15T10:00:00.000Z",
  updated_at: "2026-01-15T10:00:00.000Z",
  paid_at: "2026-01-15T10:01:00.000Z",
  items: [
    {
      id: "item-1",
      order_id: "verified-order",
      product_id: "product-1",
      product_category: "Kopi",
      product_name: "Kopi Susu",
      quantity: 1,
      unit_price: 25000,
      subtotal: 25000,
      created_at: "2026-01-15T10:00:00.000Z",
    },
  ],
  payments: [verifiedPayment],
};

describe("admin report export", () => {
  it("returns a non-empty Excel file with a download filename", async () => {
    const file = await exportAdminReportToExcel(
      [
        verifiedOrder,
        {
          ...verifiedOrder,
          id: "pending-order",
          order_number: "BB-2026-002",
          payment_status: "PENDING",
          payments: [
            {
              ...verifiedPayment,
              id: "payment-2",
              order_id: "pending-order",
              payment_status: "PENDING",
              verified: false,
            },
          ],
        },
      ],
      "monthly",
      range,
    );

    expect(file.fileName).toMatch(/\.xlsx$/);
    expect(file.blob.type).toContain("spreadsheetml");
    expect(file.blob.size).toBeGreaterThan(0);
  });
});
