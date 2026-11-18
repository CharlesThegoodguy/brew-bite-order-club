import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import writeExcelFile, {
  type Cell,
  type CellObject,
  type SheetData,
} from "write-excel-file/browser";

import {
  formatOrderProductDetails,
  getVerifiedPaidOrders,
  getReportDateLabel,
  getReportFileName,
  getReportPeriodLabel,
  summarizeOrderProductsByCategory,
  summarizeVerifiedPaidOrders,
  type AdminOrder,
  type ReportDateRange,
  type ReportPeriod,
} from "@/lib/admin-reports";

const formatRupiah = (amount: number) => `Rp${amount.toLocaleString("id-ID")}`;

const formatDateTime = (date: string) =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(date),
  );

const reportColors = {
  title: "#3B0A0A",
  header: "#641C1B",
  headerText: "#FFFFFF",
  text: "#2D2323",
  muted: "#6B5A4A",
  band: "#F5F1E6",
  border: "#E5DED0",
};

function cell(
  value: string | number | boolean | null,
  style: Omit<CellObject, "value"> = {},
): Cell {
  return value === null ? null : { value, ...style };
}

function mergedRow(value: string, columnCount: number, title = false): Cell[] {
  return [
    cell(value, {
      columnSpan: columnCount,
      backgroundColor: title ? reportColors.title : reportColors.band,
      textColor: title ? reportColors.headerText : reportColors.text,
      fontWeight: "bold",
      fontSize: title ? 18 : 11,
      alignVertical: "center",
      height: title ? 34 : 24,
    }),
    ...Array.from({ length: columnCount - 1 }, () => null),
  ];
}

function headerRow(labels: string[]): Cell[] {
  return labels.map((label) =>
    cell(label, {
      backgroundColor: reportColors.header,
      textColor: reportColors.headerText,
      fontWeight: "bold",
      align: "center",
      alignVertical: "center",
      wrap: true,
      height: 30,
      bottomBorderColor: reportColors.border,
      bottomBorderStyle: "thin",
    }),
  );
}

function dataRow(
  values: (string | number | boolean | null)[],
  rowIndex: number,
  numericColumns: readonly number[] = [],
): Cell[] {
  return values.map((value, columnIndex) =>
    cell(value, {
      backgroundColor: rowIndex % 2 === 0 ? "#FFFFFF" : reportColors.band,
      textColor: reportColors.text,
      alignVertical: "top",
      wrap: true,
      bottomBorderColor: reportColors.border,
      bottomBorderStyle: "thin",
      ...(numericColumns.includes(columnIndex) ? { align: "right" as const, format: "#,##0" } : {}),
    }),
  );
}

export type AdminReportFile = { blob: Blob; fileName: string };

export async function exportAdminReportToExcel(
  orders: readonly AdminOrder[],
  period: ReportPeriod,
  range: ReportDateRange,
): Promise<AdminReportFile> {
  const verifiedOrders = getVerifiedPaidOrders(orders);
  const summary = summarizeVerifiedPaidOrders(verifiedOrders);
  const categorySummary = summarizeOrderProductsByCategory(verifiedOrders);
  const periodLabel = getReportPeriodLabel(period, range);
  const categoryRows: [string, number][] = [
    ["Kopi", categorySummary.Kopi],
    ["Dessert", categorySummary.Dessert],
    ["Bundling", categorySummary.Bundling],
  ];
  if (categorySummary["Tidak diketahui"] > 0) {
    categoryRows.push(["Jenis tidak diketahui", categorySummary["Tidak diketahui"]]);
  }
  const summaryData: SheetData = [
    mergedRow("REKAP BEAN & BITE", 2, true),
    [
      cell("Periode", { fontWeight: "bold", textColor: reportColors.muted }),
      cell(periodLabel, { textColor: reportColors.text }),
    ],
    [
      cell("Rentang tanggal", { fontWeight: "bold", textColor: reportColors.muted }),
      cell(getReportDateLabel(range), { textColor: reportColors.text }),
    ],
    [null, null],
    headerRow(["Metrik", "Nilai"]),
    dataRow(["Pesanan PAID terverifikasi", summary.orderCount], 0, [1]),
    dataRow(["Omzet terverifikasi (Rp)", summary.verifiedPaidAmount], 1, [1]),
    [null, null],
    headerRow(["Jenis produk", "Jumlah terjual (pcs)"]),
    ...categoryRows.map(([category, quantity], rowIndex) =>
      dataRow([category, quantity], rowIndex, [1]),
    ),
  ];

  const orderHeaders = [
    "No. pesanan",
    "Tanggal",
    "Customer",
    "Produk / jumlah",
    "Total (Rp)",
    "Status pesanan",
    "Status pembayaran",
  ];
  const orderData: SheetData = [
    mergedRow("DAFTAR PESANAN", orderHeaders.length, true),
    mergedRow(`Periode: ${periodLabel}`, orderHeaders.length),
    Array.from({ length: orderHeaders.length }, () => null),
    headerRow(orderHeaders),
    ...verifiedOrders.map((order, rowIndex) =>
      dataRow(
        [
          order.order_number,
          formatDateTime(order.created_at),
          `${order.customer_name}\n${order.customer_whatsapp}`,
          formatOrderProductDetails(order.items),
          order.total_amount,
          order.order_status,
          "PAID (terverifikasi)",
        ],
        rowIndex,
        [4],
      ),
    ),
  ];

  const productHeaders = [
    "Nomor pesanan",
    "Tanggal",
    "Nama customer",
    "Jenis",
    "Produk",
    "Jumlah",
    "Harga satuan (Rp)",
    "Subtotal (Rp)",
  ];
  const productData: SheetData = [
    mergedRow("RINCIAN PRODUK PESANAN", productHeaders.length, true),
    mergedRow(`Periode: ${periodLabel}`, productHeaders.length),
    Array.from({ length: productHeaders.length }, () => null),
    headerRow(productHeaders),
    ...verifiedOrders.flatMap((order) =>
      order.items.length > 0
        ? order.items.map((item, rowIndex) =>
            dataRow(
              [
                order.order_number,
                formatDateTime(order.created_at),
                order.customer_name,
                item.product_category ?? "Tidak diketahui",
                item.product_name,
                item.quantity,
                item.unit_price,
                item.subtotal,
              ],
              rowIndex,
              [5, 6, 7],
            ),
          )
        : [
            dataRow(
              [
                order.order_number,
                formatDateTime(order.created_at),
                order.customer_name,
                "Tidak diketahui",
                "Detail produk belum tersimpan untuk pesanan ini",
                null,
                null,
                null,
              ],
              0,
            ),
          ],
    ),
  ];

  const infoHeaders = ["No. pesanan", "Customer", "WhatsApp", "Metode pembayaran", "Catatan"];
  const infoData: SheetData = [
    mergedRow("INFORMASI PESANAN", infoHeaders.length, true),
    mergedRow(`Periode: ${periodLabel}`, infoHeaders.length),
    Array.from({ length: infoHeaders.length }, () => null),
    headerRow(infoHeaders),
    ...verifiedOrders.map((order, rowIndex) =>
      dataRow(
        [
          order.order_number,
          order.customer_name,
          order.customer_whatsapp,
          order.payment_method,
          order.notes ?? "",
        ],
        rowIndex,
      ),
    ),
  ];

  const paymentHeaders = [
    "Nomor pesanan",
    "Tanggal transaksi",
    "Metode pembayaran",
    "Referensi",
    "Jumlah (Rp)",
    "Status",
    "Terverifikasi",
  ];
  const paymentData: SheetData = [
    mergedRow("RIWAYAT PEMBAYARAN", paymentHeaders.length, true),
    mergedRow(`Periode: ${periodLabel}`, paymentHeaders.length),
    Array.from({ length: paymentHeaders.length }, () => null),
    headerRow(paymentHeaders),
    ...verifiedOrders.flatMap((order) =>
      order.payments
        .filter((payment) => payment.payment_status === "PAID" && payment.verified)
        .map((payment, rowIndex) =>
          dataRow(
            [
              order.order_number,
              formatDateTime(payment.transaction_date),
              payment.payment_method,
              payment.payment_reference ?? "",
              payment.amount,
              payment.payment_status,
              "Ya",
            ],
            rowIndex,
            [4],
          ),
        ),
    ),
  ];

  const blob = await writeExcelFile(
    [
      {
        sheet: "Ringkasan",
        data: summaryData,
        columns: [{ width: 34 }, { width: 38 }],
      },
      {
        sheet: "Pesanan",
        data: orderData,
        stickyRowsCount: 4,
        columns: [
          { width: 20 },
          { width: 22 },
          { width: 30 },
          { width: 42 },
          { width: 18 },
          { width: 22 },
          { width: 24 },
        ],
      },
      {
        sheet: "Rincian Produk",
        data: productData,
        stickyRowsCount: 4,
        columns: [
          { width: 22 },
          { width: 22 },
          { width: 26 },
          { width: 18 },
          { width: 36 },
          { width: 12 },
          { width: 22 },
          { width: 20 },
        ],
      },
      {
        sheet: "Info Pesanan",
        data: infoData,
        stickyRowsCount: 4,
        columns: [{ width: 22 }, { width: 28 }, { width: 22 }, { width: 24 }, { width: 48 }],
      },
      {
        sheet: "Pembayaran",
        data: paymentData,
        stickyRowsCount: 4,
        columns: [
          { width: 22 },
          { width: 22 },
          { width: 22 },
          { width: 32 },
          { width: 18 },
          { width: 18 },
          { width: 18 },
        ],
      },
    ],
    { fontFamily: "Arial", fontSize: 10 },
  ).toBlob();

  return { blob, fileName: getReportFileName(period, range, "xlsx") };
}

export function exportAdminReportToPdf(
  orders: readonly AdminOrder[],
  period: ReportPeriod,
  range: ReportDateRange,
): AdminReportFile {
  const verifiedOrders = getVerifiedPaidOrders(orders);
  const summary = summarizeVerifiedPaidOrders(verifiedOrders);
  const categorySummary = summarizeOrderProductsByCategory(verifiedOrders);
  const document = new jsPDF({ orientation: "landscape" });
  document.setProperties({
    title: "Rekap Bean & Bite",
    subject: getReportPeriodLabel(period, range),
  });
  document.setFontSize(16);
  document.text("Rekap Bean & Bite", 14, 16);
  document.setFontSize(10);
  document.text(`Periode: ${getReportPeriodLabel(period, range)}`, 14, 23);
  document.text(
    `Pesanan PAID terverifikasi: ${summary.orderCount} | Omzet terverifikasi: ${formatRupiah(summary.verifiedPaidAmount)}`,
    14,
    30,
  );

  document.setFontSize(11);
  document.text("Jumlah produk terjual per jenis", 14, 38);
  const categoryRows: string[][] = [
    ["Kopi", String(categorySummary.Kopi)],
    ["Dessert", String(categorySummary.Dessert)],
    ["Bundling", String(categorySummary.Bundling)],
  ];
  if (categorySummary["Tidak diketahui"] > 0) {
    categoryRows.push(["Jenis tidak diketahui", String(categorySummary["Tidak diketahui"])]);
  }
  autoTable(document, {
    startY: 41,
    head: [["Jenis produk", "Jumlah terjual (pcs)"]],
    body: categoryRows,
    margin: { left: 14 },
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [101, 28, 27] },
    columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 45, halign: "right" } },
  });

  autoTable(document, {
    startY: 82,
    head: [
      [
        "No. pesanan",
        "Tanggal",
        "Customer",
        "Produk / jumlah",
        "Total",
        "Status pesanan",
        "Status pembayaran",
      ],
    ],
    body: verifiedOrders.map((order) => [
      order.order_number,
      formatDateTime(order.created_at),
      `${order.customer_name}\n${order.customer_whatsapp}`,
      formatOrderProductDetails(order.items, "\n"),
      formatRupiah(order.total_amount),
      order.order_status,
      "PAID (terverifikasi)",
    ]),
    margin: { left: 10, right: 10 },
    styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [101, 28, 27] },
    columnStyles: {
      0: { cellWidth: 34 },
      1: { cellWidth: 27 },
      2: { cellWidth: 42 },
      3: { cellWidth: 79 },
      4: { cellWidth: 25 },
      5: { cellWidth: 28 },
      6: { cellWidth: 32 },
    },
  });

  return {
    blob: document.output("blob"),
    fileName: getReportFileName(period, range, "pdf"),
  };
}
