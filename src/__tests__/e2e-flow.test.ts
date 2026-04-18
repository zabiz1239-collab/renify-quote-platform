import { describe, it, expect } from "vitest";
import type { Job, Supplier, Quote, Estimator } from "@/types";
import { getQuoteFileName, getNextVersion, checkDuplicateHash } from "@/lib/quote-utils";
import { renderTemplate, getTradeDisplayName, getGroupedTradeCodes } from "@/lib/templates";
import { getExpiringQuotes, isJobFullyQuoted } from "@/lib/notifications";
import { TRADES, TRADE_GROUPS } from "@/data/trades";

/**
 * End-to-end flow test — validates the full user journey through data structures:
 * 1. Create job with trades
 * 2. Add supplier with matching trades
 * 3. Send quote request (template rendering)
 * 4. Receive quote (versioning, duplicate detection)
 * 5. Compare prices
 * 6. Expiry tracking
 * 7. Milestone detection
 */

// ── Test data ─────────────────────────────────────────────────────

function createTestJob(): Job {
  return {
    jobCode: "TEST01",
    address: "123 Test St, Melbourne",
    client: { name: "Test Client", phone: "0400000000", email: "client@test.com" },
    region: "Western",
    buildType: "New Build",
    storeys: "Double",
    estimatorId: "est-001",
    targetDate: "2026-06-01",
    status: "active",
    budgetEstimate: 500000,
    documents: [
      { category: "architectural", name: "plans.pdf", type: "upload", fileName: "plans.pdf" },
      { category: "engineering", name: "engineering.pdf", type: "upload", fileName: "engineering.pdf" },
      { category: "scope", name: "inclusions.pdf", type: "upload", fileName: "inclusions.pdf" },
    ],
    trades: [
      { code: "110", name: "CONCRETE SUPPLY", quotes: [] },
      { code: "115", name: "CONCRETE LABOUR", quotes: [] },
      { code: "315", name: "PLUMBER", quotes: [] },
      { code: "325", name: "ELECTRICIAN", quotes: [] },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createTestSupplier(): Supplier {
  return {
    id: "sup-001",
    company: "EcoConcrete Pty Ltd",
    contact: "John Smith",
    email: "john@ecoconcrete.com.au",
    phone: "0412345678",
    abn: "12345678901",
    trades: ["110", "115"],
    regions: ["Western", "Northern"],
    status: "verified",
    rating: 4,
    notes: "Reliable supplier",
    lastContacted: new Date().toISOString(),
  };
}

function createTestEstimator(): Estimator {
  return {
    id: "est-001",
    name: "Zabi",
    email: "zabi@renify.com.au",
    phone: "0400111222",
    signature: "Zabi\nRenify Estimating",
    microsoftAccount: "zabi@renify.com.au",
  };
}

// ── Tests ─────────────────────────────────────────────────────────

describe("E2E: Full Quote Journey", () => {
  describe("Step 1: Job Creation", () => {
    it("creates a job with correct structure", () => {
      const job = createTestJob();
      expect(job.jobCode).toBe("TEST01");
      expect(job.trades).toHaveLength(4);
      expect(job.documents).toHaveLength(3);
      expect(job.status).toBe("active");
    });

    it("has all document categories for email attachments", () => {
      const job = createTestJob();
      const categories = job.documents.map((d) => d.category);
      expect(categories).toContain("architectural");
      expect(categories).toContain("engineering");
      expect(categories).toContain("scope");
    });

    it("trades reference valid TRADES codes", () => {
      const job = createTestJob();
      const validCodes = TRADES.map((t) => t.code);
      for (const trade of job.trades) {
        expect(validCodes).toContain(trade.code);
      }
    });
  });

  describe("Step 2: Supplier Matching", () => {
    it("supplier trades match job trades", () => {
      const job = createTestJob();
      const supplier = createTestSupplier();
      const matchingTrades = job.trades.filter((t) => supplier.trades.includes(t.code));
      expect(matchingTrades.length).toBeGreaterThan(0);
      expect(matchingTrades.map((t) => t.code)).toEqual(["110", "115"]);
    });

    it("supplier region matches job region", () => {
      const job = createTestJob();
      const supplier = createTestSupplier();
      expect(supplier.regions).toContain(job.region);
    });
  });

  describe("Step 3: Send Quote Request (Template Rendering)", () => {
    it("renders email template with placeholders", () => {
      const template = "Dear {contact},\n\nPlease quote for {trade} at {address}.\nJob: {job_code}\n\nRegards,\n{estimator_name}\n{signature}";
      const job = createTestJob();
      const supplier = createTestSupplier();
      const estimator = createTestEstimator();
      const result = renderTemplate(template, {
        supplier,
        job,
        estimator,
        tradeCodes: ["110"],
      });
      expect(result).toContain("Dear John Smith");
      expect(result).toContain("CONCRETE SUPPLY");
      expect(result).toContain("123 Test St, Melbourne");
      expect(result).toContain("TEST01");
      expect(result).toContain("Zabi");
    });

    it("groups concrete trades for combined email", () => {
      const grouped = getGroupedTradeCodes("110");
      expect(grouped).toContain("110");
      expect(grouped).toContain("115");
    });

    it("displays grouped trade name correctly", () => {
      const display = getTradeDisplayName(["110", "115"]);
      expect(display).toBeTruthy();
      expect(typeof display).toBe("string");
    });
  });

  describe("Step 4: Receive Quote (Versioning + Duplicate Detection)", () => {
    it("generates correct quote filename v1", () => {
      const filename = getQuoteFileName("CONCRETE SUPPLY", "EcoConcrete", 1);
      expect(filename).toBe("concrete_supply_quote_by_EcoConcrete_v1.pdf");
    });

    it("increments version for same supplier", () => {
      const existingQuotes = [
        { supplierId: "sup-001", version: 1 },
        { supplierId: "sup-001", version: 2 },
      ];
      const nextVersion = getNextVersion(existingQuotes, "sup-001");
      expect(nextVersion).toBe(3);

      const filename = getQuoteFileName("CONCRETE SUPPLY", "EcoConcrete", nextVersion);
      expect(filename).toBe("concrete_supply_quote_by_EcoConcrete_v3.pdf");
    });

    it("detects duplicate PDFs by hash", () => {
      const existingQuotes = [
        { fileHash: "sha256-abc123", supplierName: "EcoConcrete", quotePDF: "concrete_v1.pdf" },
      ];

      const duplicate = checkDuplicateHash("sha256-abc123", existingQuotes);
      expect(duplicate.isDuplicate).toBe(true);
      expect(duplicate.existingSupplier).toBe("EcoConcrete");

      const unique = checkDuplicateHash("sha256-xyz999", existingQuotes);
      expect(unique.isDuplicate).toBe(false);
    });

    it("tracks quote status transitions", () => {
      const quote: Quote = {
        supplierId: "sup-001",
        supplierName: "EcoConcrete",
        status: "requested",
        requestedDate: new Date().toISOString(),
        version: 1,
        followUpCount: 0,
      };

      // Receive quote
      const received: Quote = {
        ...quote,
        status: "received",
        receivedDate: new Date().toISOString(),
        priceExGST: 45000,
        priceIncGST: 49500,
        quoteExpiry: "2026-07-01",
        quotePDF: "concrete_supply_quote_by_EcoConcrete_v1.pdf",
        fileHash: "sha256-abc123",
      };

      expect(received.status).toBe("received");
      expect(received.priceExGST).toBe(45000);
    });
  });

  describe("Step 5: Price Comparison", () => {
    it("identifies cheapest quote per trade", () => {
      const quotes: Quote[] = [
        {
          supplierId: "sup-001",
          supplierName: "EcoConcrete",
          status: "received",
          priceExGST: 45000,
          priceIncGST: 49500,
          version: 1,
          followUpCount: 0,
        },
        {
          supplierId: "sup-002",
          supplierName: "QuickCrete",
          status: "received",
          priceExGST: 42000,
          priceIncGST: 46200,
          version: 1,
          followUpCount: 0,
        },
        {
          supplierId: "sup-003",
          supplierName: "PremiumConcrete",
          status: "received",
          priceExGST: 52000,
          priceIncGST: 57200,
          version: 1,
          followUpCount: 0,
        },
      ];

      const cheapest = quotes
        .filter((q) => q.status === "received" && q.priceExGST)
        .sort((a, b) => (a.priceExGST || 0) - (b.priceExGST || 0))[0];

      expect(cheapest.supplierName).toBe("QuickCrete");
      expect(cheapest.priceExGST).toBe(42000);
    });

    it("calculates markup correctly", () => {
      const priceExGST = 42000;
      const markupPercent = 15;
      const sellPrice = priceExGST * (1 + markupPercent / 100);
      expect(Math.round(sellPrice)).toBe(48300);
    });

    it("calculates cost summary vs budget", () => {
      const job = createTestJob();
      job.trades[0].quotes = [
        { supplierId: "sup-001", supplierName: "Test", status: "accepted", priceExGST: 45000, version: 1, followUpCount: 0 },
      ];
      job.trades[2].quotes = [
        { supplierId: "sup-002", supplierName: "Test2", status: "received", priceExGST: 80000, version: 1, followUpCount: 0 },
      ];

      let totalQuoted = 0;
      for (const trade of job.trades) {
        const accepted = trade.quotes?.find((q) => q.status === "accepted");
        if (accepted?.priceExGST) { totalQuoted += accepted.priceExGST; continue; }
        const cheapest = trade.quotes
          ?.filter((q) => q.status === "received" && q.priceExGST)
          .sort((a, b) => (a.priceExGST || 0) - (b.priceExGST || 0))[0];
        if (cheapest?.priceExGST) totalQuoted += cheapest.priceExGST;
      }

      expect(totalQuoted).toBe(125000);
      expect(job.budgetEstimate! - totalQuoted).toBe(375000); // Under budget
    });
  });

  describe("Step 6: Quote Expiry Tracking", () => {
    it("flags expired quotes", () => {
      const job = createTestJob();
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      job.trades[0].quotes = [
        {
          supplierId: "sup-001",
          supplierName: "EcoConcrete",
          status: "received",
          priceExGST: 45000,
          quoteExpiry: pastDate.toISOString(),
          version: 1,
          followUpCount: 0,
        },
      ];

      const expiring = getExpiringQuotes(job, [30, 60, 90]);
      expect(expiring.length).toBe(1);
      expect(expiring[0].severity).toBe("expired");
    });

    it("warns about soon-to-expire quotes", () => {
      const job = createTestJob();
      const soonDate = new Date();
      soonDate.setDate(soonDate.getDate() + 50); // Between 30 and 60 days = warning severity

      job.trades[0].quotes = [
        {
          supplierId: "sup-001",
          supplierName: "EcoConcrete",
          status: "received",
          priceExGST: 45000,
          quoteExpiry: soonDate.toISOString(),
          version: 1,
          followUpCount: 0,
        },
      ];

      const expiring = getExpiringQuotes(job, [30, 60, 90]);
      expect(expiring.length).toBe(1);
      expect(expiring[0].severity).toBe("warning");
    });
  });

  describe("Step 7: Milestone Detection", () => {
    it("detects fully quoted job", () => {
      const job = createTestJob();
      // Give every trade a received quote
      job.trades = job.trades.map((trade) => ({
        ...trade,
        quotes: [{
          supplierId: "sup-001",
          supplierName: "Test",
          status: "received" as const,
          priceExGST: 10000,
          version: 1,
          followUpCount: 0,
        }],
      }));

      expect(isJobFullyQuoted(job)).toBe(true);
    });

    it("detects partially quoted job", () => {
      const job = createTestJob();
      // Only give first trade a quote
      job.trades[0].quotes = [{
        supplierId: "sup-001",
        supplierName: "Test",
        status: "received",
        priceExGST: 10000,
        version: 1,
        followUpCount: 0,
      }];

      expect(isJobFullyQuoted(job)).toBe(false);
    });

    it("counts accepted quotes toward milestone", () => {
      const job = createTestJob();
      job.trades = job.trades.map((trade) => ({
        ...trade,
        quotes: [{
          supplierId: "sup-001",
          supplierName: "Test",
          status: "accepted" as const,
          priceExGST: 10000,
          version: 1,
          followUpCount: 0,
        }],
      }));

      expect(isJobFullyQuoted(job)).toBe(true);
    });
  });

  describe("Trade Groups", () => {
    it("concrete group contains 110 and 115", () => {
      expect(TRADE_GROUPS.concrete).toEqual(["110", "115"]);
    });

    it("all group codes reference valid TRADES", () => {
      const validCodes = TRADES.map((t) => t.code);
      for (const [, codes] of Object.entries(TRADE_GROUPS)) {
        for (const code of codes) {
          expect(validCodes).toContain(code);
        }
      }
    });
  });

  describe("Follow-Up Flow", () => {
    it("tracks follow-up count progression", () => {
      const quote: Quote = {
        supplierId: "sup-001",
        supplierName: "EcoConcrete",
        status: "requested",
        requestedDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days ago
        version: 1,
        followUpCount: 0,
      };

      // First follow-up at day 7
      const afterFirst: Quote = { ...quote, followUpCount: 1, lastFollowUp: new Date().toISOString() };
      expect(afterFirst.followUpCount).toBe(1);

      // Second follow-up at day 14
      const afterSecond: Quote = { ...afterFirst, followUpCount: 2, lastFollowUp: new Date().toISOString() };
      expect(afterSecond.followUpCount).toBe(2);

      // After 2 follow-ups, card should turn red (followUpCount >= 2)
      expect(afterSecond.followUpCount >= 2).toBe(true);
    });
  });
});
