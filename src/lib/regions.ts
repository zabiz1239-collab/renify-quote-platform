export const DEFAULT_REGIONS = [
  "Victoria",
  "Tasmania",
  "New South Wales",
  "Queensland",
  "South Australia",
  "Western Australia",
  "Northern Territory",
  "Australian Capital Territory",
  "Western",
  "Northern",
  "South East",
  "Eastern",
  "Geelong",
  "Ballarat",
];

const REGION_ALIASES: Record<string, string> = {
  vic: "victoria",
  tas: "tasmania",
  nsw: "new south wales",
  qld: "queensland",
  sa: "south australia",
  wa: "western australia",
  nt: "northern territory",
  act: "australian capital territory",
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

export function supplierMatchesRegion(
  supplierRegions: string[] | null | undefined,
  jobRegion: string | null | undefined
): boolean {
  const jobRegionKey = normalizeRegion(jobRegion);
  if (!jobRegionKey) return true;
  return (supplierRegions || []).some((region) => normalizeRegion(region) === jobRegionKey);
}
