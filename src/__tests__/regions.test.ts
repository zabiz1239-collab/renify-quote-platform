import { describe, expect, it } from "vitest";
import { DEFAULT_REGIONS, mergeRegions, normalizeRegion, supplierMatchesRegion } from "@/lib/regions";

describe("regions", () => {
  it("includes Tasmania as a default option", () => {
    expect(DEFAULT_REGIONS).toContain("Tasmania");
  });

  it("merges saved regions with the default state list", () => {
    const merged = mergeRegions(["Western", "Custom Metro"]);

    expect(merged).toContain("Tasmania");
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
});
