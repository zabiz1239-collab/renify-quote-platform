import { jsPDF } from "jspdf";

interface ComparisonRow {
  supplierName: string;
  priceExGST: number;
  priceIncGST?: number;
  sellPrice: number;
  receivedDate?: string;
  expiryDate?: string;
  version: number;
  isCheapest: boolean;
  isExpired: boolean;
}

interface HistoricalRow {
  jobCode: string;
  supplierName: string;
  priceExGST: number;
  date?: string;
}

interface ExportComparisonParams {
  jobCode: string;
  jobAddress: string;
  tradeName: string;
  tradeCode: string;
  markupPercent: number;
  rows: ComparisonRow[];
  historicalData?: HistoricalRow[];
}

const BRAND_GREEN: [number, number, number] = [45, 94, 58]; // #2D5E3A
const WHITE: [number, number, number] = [255, 255, 255];
const LIGHT_GREEN: [number, number, number] = [230, 243, 233];
const LIGHT_GRAY: [number, number, number] = [245, 245, 245];
const DARK_TEXT: [number, number, number] = [33, 33, 33];
const MEDIUM_TEXT: [number, number, number] = [100, 100, 100];

function formatCurrency(value: number): string {
  return `$${value.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function truncateText(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && doc.getTextWidth(truncated + "...") > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + "...";
}

export async function exportComparisonPDF(params: ExportComparisonParams): Promise<void> {
  const { jobCode, jobAddress, tradeName, tradeCode, markupPercent, rows, historicalData } = params;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageHeight = 210; // A4 landscape height
  const landscapeWidth = 297;
  const landscapeMargin = 15;
  let y = 15;

  function checkPageBreak(needed: number): void {
    if (y + needed > pageHeight - 20) {
      doc.addPage();
      y = 15;
    }
  }

  // --- Header ---
  doc.setFillColor(...BRAND_GREEN);
  doc.rect(0, 0, landscapeWidth, 28, "F");

  doc.setTextColor(...WHITE);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Renify Building & Construction", landscapeMargin, 12);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Price Comparison Report", landscapeMargin, 22);

  y = 36;

  // --- Job Details ---
  doc.setTextColor(...DARK_TEXT);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Job Code:", landscapeMargin, y);
  doc.setFont("helvetica", "normal");
  doc.text(jobCode, landscapeMargin + 25, y);

  doc.setFont("helvetica", "bold");
  doc.text("Address:", landscapeMargin + 80, y);
  doc.setFont("helvetica", "normal");
  doc.text(jobAddress, landscapeMargin + 100, y);

  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Trade:", landscapeMargin, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${tradeCode} - ${tradeName}`, landscapeMargin + 25, y);

  doc.setFont("helvetica", "bold");
  doc.text("Markup:", landscapeMargin + 80, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${markupPercent}%`, landscapeMargin + 100, y);

  y += 4;

  // Divider line
  doc.setDrawColor(...BRAND_GREEN);
  doc.setLineWidth(0.5);
  doc.line(landscapeMargin, y, landscapeWidth - landscapeMargin, y);
  y += 6;

  // --- Price Comparison Table ---
  const colHeaders = ["Supplier", "Price ex GST", "Price inc GST", "Markup %", "Sell Price", "Date", "Expiry", "Ver."];
  const colWidths = [55, 30, 30, 22, 30, 28, 28, 14]; // total ~237 fits in landscape content width ~267

  // Table header
  doc.setFillColor(...BRAND_GREEN);
  const headerHeight = 8;
  let colX = landscapeMargin;
  doc.rect(landscapeMargin, y, colWidths.reduce((a, b) => a + b, 0), headerHeight, "F");

  doc.setTextColor(...WHITE);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  colHeaders.forEach((header, i) => {
    const align = i === 0 ? "left" : "right";
    const textX = align === "left" ? colX + 2 : colX + colWidths[i] - 2;
    doc.text(header, textX, y + 5.5, { align });
    colX += colWidths[i];
  });

  y += headerHeight;

  // Table rows
  const rowHeight = 7;
  doc.setFontSize(8);

  rows.forEach((row, index) => {
    checkPageBreak(rowHeight);

    // Alternating row background + cheapest highlight
    if (row.isCheapest) {
      doc.setFillColor(...LIGHT_GREEN);
      doc.rect(landscapeMargin, y, colWidths.reduce((a, b) => a + b, 0), rowHeight, "F");
    } else if (index % 2 === 0) {
      doc.setFillColor(...LIGHT_GRAY);
      doc.rect(landscapeMargin, y, colWidths.reduce((a, b) => a + b, 0), rowHeight, "F");
    }

    const textY = y + 5;
    colX = landscapeMargin;

    // Expired rows get red text for expiry column; cheapest rows get bold
    const baseColor: [number, number, number] = row.isCheapest ? BRAND_GREEN : DARK_TEXT;
    const fontStyle = row.isCheapest ? "bold" : "normal";

    doc.setFont("helvetica", fontStyle);
    doc.setTextColor(...baseColor);

    // Supplier
    const supplierLabel = row.isCheapest
      ? truncateText(doc, row.supplierName + " *", colWidths[0] - 4)
      : truncateText(doc, row.supplierName, colWidths[0] - 4);
    doc.text(supplierLabel, colX + 2, textY);
    colX += colWidths[0];

    // Price ex GST
    doc.text(formatCurrency(row.priceExGST), colX + colWidths[1] - 2, textY, { align: "right" });
    colX += colWidths[1];

    // Price inc GST
    doc.text(row.priceIncGST != null ? formatCurrency(row.priceIncGST) : "-", colX + colWidths[2] - 2, textY, { align: "right" });
    colX += colWidths[2];

    // Markup %
    doc.text(`${markupPercent}%`, colX + colWidths[3] - 2, textY, { align: "right" });
    colX += colWidths[3];

    // Sell Price
    doc.text(formatCurrency(row.sellPrice), colX + colWidths[4] - 2, textY, { align: "right" });
    colX += colWidths[4];

    // Date
    doc.text(formatDate(row.receivedDate), colX + colWidths[5] - 2, textY, { align: "right" });
    colX += colWidths[5];

    // Expiry - red if expired
    if (row.isExpired) {
      doc.setTextColor(200, 30, 30);
    }
    doc.text(formatDate(row.expiryDate), colX + colWidths[6] - 2, textY, { align: "right" });
    colX += colWidths[6];

    // Version
    doc.setTextColor(...baseColor);
    doc.text(`v${row.version}`, colX + colWidths[7] - 2, textY, { align: "right" });

    y += rowHeight;
  });

  // Legend
  y += 4;
  checkPageBreak(10);
  doc.setFontSize(7);
  doc.setTextColor(...MEDIUM_TEXT);
  doc.setFont("helvetica", "italic");
  doc.text("* Cheapest quote", landscapeMargin, y);
  y += 8;

  // --- Historical Data Table ---
  if (historicalData && historicalData.length > 0) {
    checkPageBreak(30);

    doc.setTextColor(...DARK_TEXT);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Historical Pricing", landscapeMargin, y);
    y += 6;

    const histHeaders = ["Job Code", "Supplier", "Price ex GST", "Date"];
    const histWidths = [40, 70, 40, 40];

    // Header
    doc.setFillColor(...BRAND_GREEN);
    doc.rect(landscapeMargin, y, histWidths.reduce((a, b) => a + b, 0), headerHeight, "F");

    doc.setTextColor(...WHITE);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    colX = landscapeMargin;
    histHeaders.forEach((header, i) => {
      const align = i <= 1 ? "left" : "right";
      const textX = align === "left" ? colX + 2 : colX + histWidths[i] - 2;
      doc.text(header, textX, y + 5.5, { align });
      colX += histWidths[i];
    });
    y += headerHeight;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");

    historicalData.forEach((row, index) => {
      checkPageBreak(rowHeight);

      if (index % 2 === 0) {
        doc.setFillColor(...LIGHT_GRAY);
        doc.rect(landscapeMargin, y, histWidths.reduce((a, b) => a + b, 0), rowHeight, "F");
      }

      doc.setTextColor(...DARK_TEXT);
      const textY = y + 5;
      colX = landscapeMargin;

      doc.text(row.jobCode, colX + 2, textY);
      colX += histWidths[0];

      doc.text(truncateText(doc, row.supplierName, histWidths[1] - 4), colX + 2, textY);
      colX += histWidths[1];

      doc.text(formatCurrency(row.priceExGST), colX + histWidths[2] - 2, textY, { align: "right" });
      colX += histWidths[2];

      doc.text(formatDate(row.date), colX + histWidths[3] - 2, textY, { align: "right" });

      y += rowHeight;
    });
  }

  // --- Footer ---
  const footerY = pageHeight - 10;
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.setDrawColor(...BRAND_GREEN);
    doc.setLineWidth(0.3);
    doc.line(landscapeMargin, footerY - 3, landscapeWidth - landscapeMargin, footerY - 3);

    doc.setFontSize(7);
    doc.setTextColor(...MEDIUM_TEXT);
    doc.setFont("helvetica", "normal");

    const generatedDate = new Date().toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    doc.text(`Generated: ${generatedDate}`, landscapeMargin, footerY);
    doc.text(`Page ${page} of ${totalPages}`, landscapeWidth - landscapeMargin, footerY, { align: "right" });
  }

  // Save / trigger download
  const filename = `${jobCode}_${tradeCode}_price_comparison.pdf`;
  doc.save(filename);
}
