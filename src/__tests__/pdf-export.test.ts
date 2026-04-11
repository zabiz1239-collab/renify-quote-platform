import { describe, it, expect, vi } from 'vitest';

// Mock jsPDF before importing the module
vi.mock('jspdf', () => {
  class MockJsPDF {
    setFillColor() {}
    setTextColor() {}
    setFontSize() {}
    setFont() {}
    setDrawColor() {}
    setLineWidth() {}
    rect() {}
    line() {}
    text() {}
    addPage() {}
    setPage() {}
    save() {}
    getTextWidth() { return 20; }
    getNumberOfPages() { return 1; }
  }
  return {
    jsPDF: MockJsPDF,
  };
});

import { exportComparisonPDF } from '@/lib/pdf-export';

describe('PDF Export', () => {
  it('exportComparisonPDF runs without error', async () => {
    await expect(
      exportComparisonPDF({
        jobCode: 'TEST01',
        jobAddress: '123 Test St',
        tradeName: 'CONCRETE SUPPLY',
        tradeCode: '110',
        markupPercent: 15,
        rows: [
          {
            supplierName: 'Test Supplier',
            priceExGST: 10000,
            priceIncGST: 11000,
            sellPrice: 11500,
            receivedDate: '2026-04-01',
            expiryDate: '2026-07-01',
            version: 1,
            isCheapest: true,
            isExpired: false,
          },
        ],
      })
    ).resolves.toBeUndefined();
  });

  it('handles empty rows', async () => {
    await expect(
      exportComparisonPDF({
        jobCode: 'TEST01',
        jobAddress: '123 Test St',
        tradeName: 'PLUMBER',
        tradeCode: '315',
        markupPercent: 10,
        rows: [],
      })
    ).resolves.toBeUndefined();
  });

  it('handles historical data', async () => {
    await expect(
      exportComparisonPDF({
        jobCode: 'TEST01',
        jobAddress: '123 Test St',
        tradeName: 'ELECTRICIAN',
        tradeCode: '325',
        markupPercent: 12,
        rows: [
          {
            supplierName: 'SparkBros',
            priceExGST: 22000,
            priceIncGST: 24200,
            sellPrice: 24640,
            version: 1,
            isCheapest: true,
            isExpired: false,
          },
        ],
        historicalData: [
          {
            jobCode: 'OLD01',
            supplierName: 'SparkBros',
            priceExGST: 18000,
            date: '2025-12-01',
          },
          {
            jobCode: 'OLD02',
            supplierName: 'Other Elec',
            priceExGST: 20000,
            date: '2025-11-01',
          },
        ],
      })
    ).resolves.toBeUndefined();
  });
});
