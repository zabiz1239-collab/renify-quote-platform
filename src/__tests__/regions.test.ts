import { describe, expect, it } from "vitest";
import {
  DEFAULT_REGIONS,
  MELBOURNE_REGION_OPTIONS,
  getSupplierRegionsForTrade,
  mergeRegions,
  normalizeRegion,
  supplierMatchesRegion,
  supplierMatchesTradeRegion,
} from "@/lib/regions";

describe("regions", () => {
  it("includes Tasmania as a default option", () => {
    expect(DEFAULT_REGIONS).toContain("Tasmania");
  });

  it("merges saved regions with the default state list", () => {
    const merged = mergeRegions(["Western", "Custom Metro"]);

    expect(merged).toContain("Tasmania");
    expect(merged).toContain("West");
    expect(merged).not.toContain("Western");
    expect(merged).toContain("Custom Metro");
  });

  it("normalizes common Australian state abbreviations", () => {
    expect(normalizeRegion("TAS")).toBe("tasmania");
    expect(normalizeRegion("NSW")).toBe("new south wales");
  });

  it("matches suppliers to the selected job state or region", () => {
    expect(supplierMatchesRegion(["TAS"], "Tasmania")).toBe(true);
    expect(supplierMatchesRegion(["Victoria"], "Tasmania")).toBe(false);
    expect(supplierMatchesRegion([], "Tasmania")).toBe(false);
  });

  it("includes Melbourne allocation areas", () => {
    expect(MELBOURNE_REGION_OPTIONS).toEqual([
      "South East",
      "North",
      "West",
      "Regional Geelong",
      "Regional Ballarat",
      "Regional Bendigo",
      "Regional Gippsland",
    ]);
  });

  it("falls back to supplier regions when a trade has no area override", () => {
    const supplier = {
      regions: ["West"],
      tradeRegions: {
        "315": ["South East"],
      },
    };

    expect(getSupplierRegionsForTrade(supplier, "110")).toEqual(["West"]);
    expect(getSupplierRegionsForTrade(supplier, "315")).toEqual(["South East"]);
    expect(supplierMatchesTradeRegion(supplier, "315", "South East")).toBe(true);
    expect(supplierMatchesTradeRegion(supplier, "315", "West")).toBe(false);
  });
});
