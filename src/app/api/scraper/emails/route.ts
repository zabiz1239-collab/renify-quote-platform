import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSuppliers } from "@/lib/supabase";
import type { Supplier } from "@/types";

export const maxDuration = 300;

const FETCH_TIMEOUT_MS = 10000;
const DELAY_BETWEEN_FETCHES_MS = 1500;
const MAX_PER_RUN = 30;

const JUNK_EMAIL_DOMAINS = new Set([
  "wixpress.com",
  "wix.com",
  "squarespace.com",
  "godaddy.com",
  "sentry.io",
  "sentry-next.wixpress.com",
  "cloudflare.com",
  "google.com",
  "googleapis.com",
  "gstatic.com",
  "youtube.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "schema.org",
  "w3.org",
  "example.com",
]);

const PRIORITY_LOCAL_PARTS = [
  "info",
  "office",
  "admin",
  "quotes",
  "quote",
  "sales",
  "hello",
  "contact",
  "enquiries",
  "enquiry",
  "accounts",
];

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const IMAGE_EXTENSION_REGEX = /\.(png|jpe?g|gif|svg|webp|bmp|ico)$/i;

interface EmailResult {
  supplierId: string;
  company: string;
  websiteTried: string;
  email: string | null;
  reason?: string;
}

function extractWebsite(supplier: Supplier): string | null {
  if (supplier.website?.trim()) return supplier.website.trim();
  const match = supplier.notes?.match(/https?:\/\/[^\s)]+/i);
  return match?.[0]?.replace(/[.,;]+$/, "") || null;
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
}

async function fetchWithTimeout(url: string, ms: number): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "text/html,text/plain;q=0.9,*/*;q=0.1",
        "User-Agent": "RenifyQuotePlatform/1.0 email-finder",
      },
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type")?.toLowerCase() || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return null;
    }

    return response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function isJunkDomain(domain: string): boolean {
  return Array.from(JUNK_EMAIL_DOMAINS).some((junkDomain) => (
    domain === junkDomain || domain.endsWith(`.${junkDomain}`)
  ));
}

function pickPriorityEmail(emails: string[]): string | null {
  for (const localPart of PRIORITY_LOCAL_PARTS) {
    const match = emails.find((email) => email.split("@")[0] === localPart);
    if (match) return match;
  }
  return emails[0] || null;
}

function pickBestEmail(emails: string[], siteHost: string): string | null {
  const normalizedSiteHost = siteHost.toLowerCase().replace(/^www\./, "");
  const filtered = Array.from(new Set(emails.map((email) => email.toLowerCase()))).filter((email) => {
    const [localPart, domain] = email.split("@");
    if (!localPart || !domain) return false;
    if (localPart.startsWith("u003") || localPart.startsWith("x40")) return false;
    if (IMAGE_EXTENSION_REGEX.test(email)) return false;
    if (isJunkDomain(domain)) return false;
    return true;
  });

  if (filtered.length === 0) return null;

  const sameDomainEmails = filtered.filter((email) => {
    const domain = email.split("@")[1]?.replace(/^www\./, "");
    return domain === normalizedSiteHost || domain?.endsWith(`.${normalizedSiteHost}`);
  });

  return pickPriorityEmail(sameDomainEmails.length > 0 ? sameDomainEmails : filtered);
}

async function findEmailForUrl(rawUrl: string): Promise<string | null> {
  const normalized = normalizeUrl(rawUrl);
  const parsed = new URL(normalized);
  const origin = parsed.origin.replace(/\/+$/, "");
  const siteHost = parsed.hostname;
  const pageUrls = [
    origin,
    `${origin}/contact`,
    `${origin}/contact-us`,
    `${origin}/about`,
  ];

  for (const url of pageUrls) {
    const html = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
    if (!html) continue;

    const decoded = html
      .replace(/&#64;/g, "@")
      .replace(/&#x40;/gi, "@")
      .replace(/&commat;/gi, "@");
    const emails = decoded.match(EMAIL_REGEX) || [];
    const email = pickBestEmail(emails, siteHost);
    if (email) return email;
  }

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { supplierIds?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const supplierIds = Array.isArray(body.supplierIds)
    ? new Set(body.supplierIds.filter((id): id is string => typeof id === "string"))
    : null;

  try {
    const suppliers = await getSuppliers();
    const targets = suppliers
      .filter((supplier) => {
        if (supplier.email?.trim()) return false;
        if (!extractWebsite(supplier)) return false;
        return !supplierIds || supplierIds.has(supplier.id);
      })
      .slice(0, MAX_PER_RUN);

    const results: EmailResult[] = [];

    for (let index = 0; index < targets.length; index++) {
      const supplier = targets[index];
      if (index > 0) await sleep(DELAY_BETWEEN_FETCHES_MS);

      const rawWebsite = extractWebsite(supplier);
      if (!rawWebsite) continue;

      let websiteTried = rawWebsite;
      try {
        websiteTried = normalizeUrl(rawWebsite);
        new URL(websiteTried);
      } catch {
        results.push({
          supplierId: supplier.id,
          company: supplier.company,
          websiteTried,
          email: null,
          reason: "Invalid website URL",
        });
        continue;
      }

      const email = await findEmailForUrl(websiteTried);
      results.push({
        supplierId: supplier.id,
        company: supplier.company,
        websiteTried,
        email,
        reason: email ? undefined : "No email found",
      });
    }

    return NextResponse.json({
      processed: results.length,
      found: results.filter((result) => result.email).length,
      results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Email scraper failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
