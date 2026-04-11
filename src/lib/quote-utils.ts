import { TRADES } from "@/data/trades";

// Generate the standardized quote filename
export function getQuoteFileName(
  tradeName: string,
  supplierName: string,
  version: number
): string {
  const sanitizedTrade = tradeName.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  const sanitizedSupplier = supplierName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
  return `${sanitizedTrade}_quote_by_${sanitizedSupplier}_v${version}.pdf`;
}

// Get the next version number for a supplier+trade combination
export function getNextVersion(
  existingQuotes: { supplierId: string; version: number }[],
  supplierId: string
): number {
  const existing = existingQuotes.filter((q) => q.supplierId === supplierId);
  if (existing.length === 0) return 1;
  return Math.max(...existing.map((q) => q.version)) + 1;
}

// Compute SHA-256 hash of a file (browser-side using Web Crypto)
export async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Check for duplicate hash in existing quotes
export function checkDuplicateHash(
  hash: string,
  allQuotes: { fileHash?: string; supplierName: string; quotePDF?: string }[]
): { isDuplicate: boolean; existingFile?: string; existingSupplier?: string } {
  for (const q of allQuotes) {
    if (q.fileHash === hash) {
      return {
        isDuplicate: true,
        existingFile: q.quotePDF,
        existingSupplier: q.supplierName,
      };
    }
  }
  return { isDuplicate: false };
}

// Get trade name by code
export function getTradeNameByCode(code: string): string {
  const trade = TRADES.find((t) => t.code === code);
  return trade?.name || code;
}
