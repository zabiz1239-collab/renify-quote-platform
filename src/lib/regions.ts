export const DEFAULT_REGIONS = [
  "Victoria",
  "Tasmania",
  "New South Wales",
  "Queensland",
  "South Australia",
  "Western Australia",
  "Northern Territory",
  "Australian Capital Territory",
  "South East",
  "North",
  "West",
  "Regional Geelong",
  "Regional Ballarat",
  "Regional Bendigo",
  "Regional Gippsland",
];

export const MELBOURNE_REGION_OPTIONS = [
  "South East",
  "North",
  "West",
  "Regional Geelong",
  "Regional Ballarat",
  "Regional Bendigo",
  "Regional Gippsland",
];

export type TradeRegions = Record<string, string[]>;

const REGION_ALIASES: Record<string, string> = {
  vic: "victoria",
  tas: "tasmania",
  nsw: "new south wales",
  qld: "queensland",
  sa: "south australia",
  wa: "western australia",
  nt: "northern territory",
  act: "australian capital territory",
  western: "west",
  northern: "north",
  east: "south east",
  eastern: "south east",
  "south-east": "south east",
  "south east melbourne": "south east",
  geelong: "regional geelong",
  gellong: "regional geelong",
  "regional gellong": "regional geelong",
  ballarat: "regional ballarat",
  bendigo: "regional bendigo",
  gippsland: "regional gippsland",
};

export function normalizeRegion(region: string | null | undefined): string {
  const key = (region || "").trim().toLowerCase().replace(/\s+/g, " ");
  return REGION_ALIASES[key] || key;
}

export function mergeRegions(regions: string[] | null | undefined): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const region of [...DEFAULT_REGIONS, ...(regions || [])]) {
    const trimmed = region.trim();
    const key = normalizeRegion(trimmed);
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    merged.push(trimmed);
  }

  return merged;
}

export function normalizeRegionList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    const key = normalizeRegion(trimmed);
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    result.push(DEFAULT_REGIONS.find((region) => normalizeRegion(region) === key) || trimmed);
  }

  return result;
}

export function normalizeTradeRegions(value: unknown): TradeRegions {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const normalized: TradeRegions = {};

  for (const [tradeCode, regions] of Object.entries(value)) {
    const code = tradeCode.trim();
    const normalizedRegions = normalizeRegionList(regions);
    if (code && normalizedRegions.length > 0) normalized[code] = normalizedRegions;
  }

  return normalized;
}

export function pruneTradeRegions(
  tradeRegions: TradeRegions | undefined,
  tradeCodes: string[]
): TradeRegions {
  const normalized = normalizeTradeRegions(tradeRegions);
  const allowed = new Set(tradeCodes);
  return Object.fromEntries(
    Object.entries(normalized).filter(([tradeCode]) => allowed.has(tradeCode))
  );
}

export function getSupplierRegionsForTrade(
  supplier: { regions?: string[]; tradeRegions?: TradeRegions } | null | undefined,
  tradeCode: string | null | undefined
): string[] {
  const tradeRegions = tradeCode ? normalizeRegionList(supplier?.tradeRegions?.[tradeCode]) : [];
  return tradeRegions.length > 0 ? tradeRegions : normalizeRegionList(supplier?.regions);
}

export function supplierMatchesRegion(
  supplierRegions: string[] | null | undefined,
  jobRegion: string | null | undefined
): boolean {
  const jobRegionKey = normalizeRegion(jobRegion);
  if (!jobRegionKey) return true;
  return (supplierRegions || []).some((region) => normalizeRegion(region) === jobRegionKey);
}

export function supplierMatchesTradeRegion(
  supplier: { regions?: string[]; tradeRegions?: TradeRegions } | null | undefined,
  tradeCode: string | null | undefined,
  jobRegion: string | null | undefined
): boolean {
  return supplierMatchesRegion(getSupplierRegionsForTrade(supplier, tradeCode), jobRegion);
}
