import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSuppliers, saveSuppliersBulk } from "@/lib/supabase";
import { TRADES } from "@/data/trades";
import type { Supplier } from "@/types";
import { v4 as uuidv4 } from "uuid";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Keywords that suggest a company is a general builder/developer rather than a specialist subcontractor
const EXCLUDE_KEYWORDS = [
      "builder",
      "builders",
      "building company",
      "construction company",
      "developer",
      "developments",
      "project management",
      "home designs",
      "display homes",
      "volume builder",
      "project homes",
    ];

interface PlaceResult {
      name: string;
      formatted_address?: string;
      formatted_phone_number?: string;
      website?: string;
      place_id: string;
      types?: string[];
}

// Filter out results that are clearly general builders or developers, not specialist trades
function isLikelySpecialist(place: PlaceResult): boolean {
      const nameLower = place.name.toLowerCase();
      return !EXCLUDE_KEYWORDS.some((kw) => nameLower.includes(kw));
}

export async function POST(request: NextRequest) {
      const session = await getServerSession(authOptions);
      if (!session?.accessToken) {
              return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    
      if (!GOOGLE_PLACES_API_KEY) {
              return NextResponse.json(
                  { error: "Google Places API key not configured" },
                  { status: 500 }
                      );
      }
    
      const body = await request.json();
      const { trade, region, preview } = body as {
              trade: string;
              region: string;
              preview?: boolean;
      };
    
      if (!trade || !region) {
              return NextResponse.json(
                  { error: "Missing required fields: trade, region" },
                  { status: 400 }
                      );
      }
    
      try {
              // Look up the trade's custom searchQuery if available, otherwise fall back to trade name
              const tradeEntry = TRADES.find(
                        (t) => t.name === trade || t.code === trade
                                ) as { code: string; name: string; quotable: boolean; searchQuery?: string } | undefined;
              const searchQuery = tradeEntry?.searchQuery ?? trade;
          
              const query = `${searchQuery} ${region} Victoria Australia`;
          
              // Fetch first page of results
              const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_PLACES_API_KEY}`;
              const searchRes = await fetch(searchUrl);
              const searchData = await searchRes.json();
          
              if (searchData.status !== "OK" && searchData.status !== "ZERO_RESULTS") {
                        return NextResponse.json(
                            { error: `Places API error: ${searchData.status}` },
                            { status: 500 }
                                  );
              }
          
              const rawResults: PlaceResult[] = (searchData.results || []).map(
                        (r: { name: string; place_id: string; types?: string[] }) => ({
                                    name: r.name,
                                    place_id: r.place_id,
                                    types: r.types,
                        })
                      );
          
              // Apply specialist filter and cap at 10 candidates to fetch details for
              const filtered = rawResults.filter(isLikelySpecialist).slice(0, 10);
          
              const places: PlaceResult[] = [];
              for (const result of filtered) {
                        const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${result.place_id}&fields=name,formatted_address,formatted_phone_number,website&key=${GOOGLE_PLACES_API_KEY}`;
                        const detailRes = await fetch(detailUrl);
                        const detailData = await detailRes.json();
                        if (detailData.status === "OK") {
                                    places.push({
                                                  name: detailData.result.name,
                                                  formatted_address: detailData.result.formatted_address,
                                                  formatted_phone_number: detailData.result.formatted_phone_number,
                                                  website: detailData.result.website,
                                                  place_id: result.place_id,
                                    });
                        }
              }
          
              // Load existing suppliers from Supabase for deduplication
              const existingSuppliers = await getSuppliers();
              const newSuppliers: Supplier[] = [];
              let skipped = 0;
          
              for (const place of places) {
                        const nameNorm = place.name.toLowerCase().trim();
                        if (
                                    existingSuppliers.some(
                                                  (s) => s.company.toLowerCase().trim() === nameNorm
                                                              )
                                  ) {
                                    skipped++;
                                    continue;
                        }
                        if (
                                    newSuppliers.some((s) => s.company.toLowerCase().trim() === nameNorm)
                                  ) {
                                    skipped++;
                                    continue;
                        }
                        newSuppliers.push({
                                    id: uuidv4(),
                                    company: place.name,
                                    contact: "",
                                    email: "",
                                    phone: place.formatted_phone_number || "",
                                    trades: [],
                                    regions: [region],
                                    status: "unverified",
                                    rating: 3,
                                    notes: `Found via Google Places. Address: ${place.formatted_address || "N/A"}${place.website ? `. Website: ${place.website}` : ""}`,
                        });
              }
          
              // Preview mode: return results without saving (for modal selection)
              if (preview) {
                        return NextResponse.json({
                                    found: places.length,
                                    searchQuery,
                                    results: places.map((p) => ({
                                                  company: p.name,
                                                  phone: p.formatted_phone_number || "",
                                                  website: p.website || "",
                                                  address: p.formatted_address || "",
                                    })),
                        });
              }
          
              if (newSuppliers.length > 0) {
                        await saveSuppliersBulk(newSuppliers);
              }
          
              return NextResponse.json({
                        found: places.length,
                        added: newSuppliers.length,
                        skipped,
                        searchQuery,
                        suppliers: newSuppliers.map((s) => ({
                                    company: s.company,
                                    phone: s.phone,
                                    region: s.regions[0],
                        })),
              });
      } catch (error: unknown) {
              const msg = error instanceof Error ? error.message : "Scraper failed";
              return NextResponse.json({ error: msg }, { status: 500 });
      }
}import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSuppliers, saveSuppliersBulk } from "@/lib/supabase";
import { TRADES } from "@/data/trades";
import type { Supplier } from "@/types";
import { v4 as uuidv4 } from "uuid";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Keywords that suggest a company is a builder/developer rather than a specialist subcontractor
const EXCLUDE_KEYWORDS = [
    "builder",
    "builders",
    "building company",
    "construction company",
    "developer",
    "developments",
    "project management",
    "home designs",
    "display homes",
    "volume builder",
    "project homes",
  ];

interface PlaceResult {
    name: string;
    formatted_address?: string;
    formatted_phone_number?: string;
    website?: string;
    place_id: string;
    types?: string[];
}

// Filter out results that are clearly general builders or developers, not specialist trades
function isLikelySpecialist(place: PlaceResult): boolean {
    const nameLower = place.name.toLowerCase();
    return !EXCLUDE_KEYWORDS.some((kw) => nameLower.includes(kw));
}

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

  if (!GOOGLE_PLACES_API_KEY) {
        return NextResponse.json(
          { error: "Google Places API key not configured" },
          { status: 500 }
              );
  }

  const body = await request.json();
    const { trade, region, preview } = body as {
          trade: string;
          region: string;
          preview?: boolean;
    };

  if (!trade || !region) {
        return NextResponse.json(
          { error: "Missing required fields: trade, region" },
          { status: 400 }
              );
  }

  try {
        // Look up the trade's custom searchQuery if available, otherwise fall back to trade name
      const tradeEntry = TRADES.find(
              (t) => t.name === trade || t.code === trade
            ) as { code: string; name: string; quotable: boolean; searchQuery?: string } | undefined;
        const searchQuery = tradeEntry?.searchQuery ?? trade;

      const query = `${searchQuery} ${region} Victoria Australia`;

      const allResults: PlaceResult[] = [];
        let nextPageToken: string | undefined;

      // Fetch up to 2 pages of results (20 candidates) for a better pool to filter from
      for (let page = 0; page < 2; page++) {
              let searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_PLACES_API_KEY}`;
              if (nextPageToken) {
                        // Google requires a short delay before using a page token
                await new Promise((r) => setTimeout(r, 2000));
                        searchUrl += `&pagetoken=${nextPageToken}`;
              }

          const searchRes = await fetch(searchUrl);
              const searchData = await searchRes.json();

          if (searchData.status !== "OK" && searchData.status !== "ZERO_RESULTS") {
                    return NextResponse.json(
                      { error: `Places API error: ${searchData.status}` },
                      { status: 500 }
                              );
          }

          for (const result of searchData.results || []) {
                    allResults.push({
                                name: result.name,
                                place_id: result.place_id,
                                types: result.types,
                    });
          }

          nextPageToken = searchData.next_page_token;
              // Stop early if no more pages
          if (!nextPageToken) break;
      }

      // Apply specialist filter and cap at 10 candidates to fetch details for
      const filtered = allResults.filter(isLikelySpecialist).slice(0, 10);

      const places: PlaceResult[] = [];
        for (const result of filtered) {
                const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${result.place_id}&fields=name,formatted_address,formatted_phone_number,website&key=${GOOGLE_PLACES_API_KEY}`;
                const detailRes = await fetch(detailUrl);
                const detailData = await detailRes.json();
                if (detailData.status === "OK") {
                          places.push({
                                      name: detailData.result.name,
                                      formatted_address: detailData.result.formatted_address,
                                      formatted_phone_number: detailData.result.formatted_phone_number,
                                      website: detailData.result.website,
                                      place_id: result.place_id,
                          });
                }
        }

      // Load existing suppliers from Supabase for deduplication
      const existingSuppliers = await getSuppliers();
        const newSuppliers: Supplier[] = [];
        let skipped = 0;

      for (const place of places) {
              const nameNorm = place.name.toLowerCase().trim();
              if (
                        existingSuppliers.some(
                                    (s) => s.company.toLowerCase().trim() === nameNorm
                                  )
                      ) {
                        skipped++;
                        continue;
              }
              if (
                        newSuppliers.some((s) => s.company.toLowerCase().trim() === nameNorm)
                      ) {
                        skipped++;
                        continue;
              }
              newSuppliers.push({
                        id: uuidv4(),
                        company: place.name,
                        contact: "",
                        email: "",
                        phone: place.formatted_phone_number || "",
                        trades: [],
                        regions: [region],
                        status: "unverified",
                        rating: 3,
                        notes: `Found via Google Places. Address: ${place.formatted_address || "N/A"}${place.website ? `. Website: ${place.website}` : ""}`,
              });
      }

      // Preview mode: return results without saving (for modal selection)
      if (preview) {
              return NextResponse.json({
                        found: places.length,
                        searchQuery,
                        results: places.map((p) => ({
                                    company: p.name,
                                    phone: p.formatted_phone_number || "",
                                    website: p.website || "",
                                    address: p.formatted_address || "",
                        })),
              });
      }

      if (newSuppliers.length > 0) {
              await saveSuppliersBulk(newSuppliers);
      }

      return NextResponse.json({
              found: places.length,
              added: newSuppliers.length,
              skipped,
              searchQuery,
              suppliers: newSuppliers.map((s) => ({
                        company: s.company,
                        phone: s.phone,
                        region: s.regions[0],
              })),
      });
  } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Scraper failed";
        return NextResponse.json({ error: msg }, { status: 500 });
  }
}
