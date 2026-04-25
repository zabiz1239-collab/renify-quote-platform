// Default OneDrive root path for all job data
export const DEFAULT_ONEDRIVE_ROOT = "Desktop/Renify Business/Renify Jobs/Jobs";

// Trade / Cost Centre
export interface Trade {
  code: string;
  name: string;
  quotable: boolean;
  group?: string;
}

// Supplier
export interface Supplier {
  id: string;
  company: string;
  contact: string;
  email: string;
  phone: string;
  abn?: string;
  cc?: string;
  trades: string[];
  regions: string[];
  status: "verified" | "unverified" | "blacklisted";
  rating: number;
  notes: string;
  lastContacted?: string;
  // Cross-job stats (calculated at read time, not stored)
  totalRequests?: number;
  totalResponses?: number;
  responseRate?: number;
  avgResponseDays?: number;
}

// Estimator
export interface Estimator {
  id: string;
  name: string;
  email: string;
  phone: string;
  signature: string;
  microsoftAccount: string;
}

// Quote (per supplier per trade per job)
export interface Quote {
  supplierId: string;
  supplierName: string;
  status: "not_started" | "requested" | "received" | "accepted" | "declined";
  requestedDate?: string;
  receivedDate?: string;
  priceExGST?: number;
  priceIncGST?: number;
  quoteExpiry?: string;
  quotePDF?: string;
  version: number;
  fileHash?: string;
  followUpCount: number;
  lastFollowUp?: string;
  ocrExtracted?: boolean;
  scopeItems?: string[];
}

// Job Document (link or uploaded file reference)
export interface JobDocument {
  category: "architectural" | "engineering" | "scope" | "colour_selection" | "energy_rating" | "other";
  name: string;
  type: "link" | "upload";
  url?: string;
  fileName?: string;
  storagePath?: string; // Supabase Storage path in project-documents bucket
}

// Job
export interface Job {
  jobCode: string;
  address: string;
  client: {
    name: string;
    phone?: string;
    email?: string;
  };
  region: string;
  buildType: "New Build" | "Dual Occ" | "Extension" | "Renovation";
  storeys: "Single" | "Double" | "Triple";
  estimatorId: string;
  targetDate?: string;
  status: "active" | "quoting" | "quoted" | "tendered" | "won" | "lost";
  budgetEstimate?: number;
  documents: JobDocument[];
  trades: {
    code: string;
    name: string;
    quotes: Quote[];
  }[];
  conflicts?: {
    timestamp: string;
    overwrittenBy: string;
    previousData: unknown;
  }[];
  createdAt: string;
  updatedAt: string;
}

// Email Template
export interface EmailTemplate {
  id: string;
  tradeCodes: string[];
  name: string;
  subject: string;
  body: string;
  type: "request" | "followup_1" | "followup_2" | "acceptance" | "decline";
}

// App Settings
export interface AppSettings {
  oneDriveRootPath: string;
  regions: string[];
  followUpDays: {
    first: number;
    second: number;
  };
  quoteExpiryWarningDays: number[];
  defaultMarkupPercent: number;
  tradeMarkupPercents?: Record<string, number>; // Per-trade markup overrides
  customTrades?: { code: string; name: string }[]; // User-defined trade categories
  supplierCategories?: SupplierCategory[]; // Custom supplier categories with search keywords
  adminEmail: string;
}

// Custom supplier category with keywords for Google Places scraping
export interface SupplierCategory {
  key: string;        // e.g. "demolition"
  label: string;      // e.g. "Demolition"
  keywords: string[]; // e.g. ["demolition contractor", "house demolition", "strip out"]
}
