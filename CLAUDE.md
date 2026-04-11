# CLAUDE.md — Renify Quote Platform

## Project
Renify Quote Platform v2 — a Next.js web app for managing construction supplier quotes with OneDrive integration.

## Tech Stack
- Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- Microsoft MSAL (OneDrive + email via Graph API)
- Claude Vision API (OCR quote extraction)
- Google Places API (supplier scraping)
- Brand colour: #2D5E3A (Renify green)

## Build Workflow — MANDATORY FOR EVERY COMPONENT

Claude Code processes sequentially. For every component in every phase, follow this exact checklist. Do NOT skip steps.

### Step 1: PLAN
- Read the spec section for this component
- List every file that needs to be created or modified
- List every type, prop, and API route involved
- Confirm the plan before writing any code

### Step 2: BUILD
- Write all files for this component
- Follow the types defined in `types/index.ts`
- Use shadcn/ui components, Tailwind for styling
- Mobile-first: all touch targets 44px+ minimum

### Step 3: CHECK
After building, run these checks in order. ALL must pass before moving on:
```bash
npx tsc --noEmit          # Zero TypeScript errors
npx next lint             # Zero lint errors  
npm run build             # Production build succeeds
```
Then manually verify:
- Read back every file you just created
- Confirm it matches the spec requirements
- Confirm mobile touch targets are 44px+
- Confirm brand colour #2D5E3A is used for primary actions

### Step 4: FIX (only if Step 3 found issues)
- Fix ONLY the issues found — do not refactor or add features
- Re-run Step 3 checks
- Loop until all checks pass
- If looping more than 3 times on the same issue, stop and re-approach the problem from scratch

### Step 5: COMMIT
```bash
git add .
git commit -m "Phase X: Component name complete"
```

Then move to the next component.

---

## Auth Architecture — Multi-User Microsoft Consent

This app uses a single Azure app registration with `tenant_id=common`. Multiple estimators will each sign in with their own Microsoft account. The auth flow must handle:

1. **NextAuth.js with Microsoft provider** — each user signs in individually
2. **Per-user token storage** — each estimator's access token and refresh token stored in the NextAuth session/JWT
3. **Consent flow** — first login for each estimator triggers Microsoft consent screen for `Files.ReadWrite.All`, `Mail.Send`, `User.Read`
4. **Send-as-user** — when sending emails via Graph API, use the signed-in estimator's token, not a shared app token
5. **OneDrive access** — all users access the same shared OneDrive/SharePoint folder, but auth is per-user

The login page should explain: "Sign in with your Microsoft account to access Renify Jobs and send quote requests from your email."

---

## Offline Sync Strategy — Last Write Wins + Conflict Log

When offline mode is implemented (Phase 5):

1. **Read:** App reads from IndexedDB first (instant), then syncs from OneDrive in background
2. **Write:** App writes to IndexedDB immediately, queues OneDrive write for when online
3. **Conflict resolution:** Last write wins (by timestamp). If two users edit the same job-config.json:
   - The later timestamp overwrites
   - The overwritten version is saved to a `_conflicts` array inside the JSON for manual review
   - Dashboard shows a ⚠️ "Sync conflict" badge if any job has unresolved conflicts
4. **Conflict review UI:** Settings → Sync Conflicts → shows both versions side by side, user picks which to keep

This is simple and practical. Construction teams rarely edit the same record simultaneously — quote intake is usually one person per job.

---

## Phase Definitions

### Phase 1 — Foundation
Build in this order:
1. Project scaffold: `npx create-next-app@14 . --typescript --tailwind --app --src-dir`
2. Install deps: shadcn/ui, @azure/msal-browser, @azure/msal-node, next-auth, @microsoft/microsoft-graph-client
3. Type definitions (`src/types/index.ts`) — see Data Model section below
4. Trade/cost centre master data (`src/data/trades.ts`) — all 58 Databuild codes
5. Microsoft MSAL auth with NextAuth.js — multi-user consent flow, per-user token storage
6. OneDrive service (`src/lib/onedrive.ts`) — browse, create folder, upload file, download file, list files
7. Layout shell — dark sidebar nav, mobile hamburger menu, Renify branding #2D5E3A
8. Job creation form + job list view (reads/writes job-config.json to OneDrive)
9. Estimator CRUD (name, email, phone, signature block, Microsoft account)
10. Supplier CRUD (company, contact, email, phone, trades, regions, status, rating, notes)
11. Supplier CSV import — upload a CSV with columns: company, contact, email, phone, trade, region → bulk add to supplier list
12. Settings page (OneDrive root path, region list, follow-up day config)

**Phase 1 done when:** App loads, user can sign in with Microsoft, create a job (folder appears in OneDrive), add estimators, add/import suppliers, see trade list.

### Phase 2 — Quoting Core
1. Quote Board — Kanban per job: Not Started → Requested → Received → Accepted → Declined. Drag-and-drop.
2. Email template engine — per cost centre, placeholder substitution. Supports GROUPED cost centres (e.g. one template for 110+115 Concrete Supply+Labour going to same supplier)
3. Template editor UI with live preview
4. Individual email send via Graph API (same Graph API path as bulk, just for one recipient)
5. Manual quote intake — upload PDF, enter price, auto-name file with version: `{trade}_quote_by_{supplier}_v1.pdf`. If same supplier+trade exists, auto-increment to `_v2`, `_v3` etc.
6. Duplicate quote detection — SHA-256 hash uploaded PDF, warn if duplicate exists
7. Dashboard — job cards with traffic lights, overdue alerts, quick stats, cost summary per job (total quoted vs budget estimate)

**Phase 2 done when:** Kanban works with drag-drop, templates render correctly, emails send via Graph API, quotes upload with versioning, dashboard shows all jobs with status and cost summary.

### Phase 3 — Automation
1. Bulk email send via Graph API — select job, select trades, tick suppliers, "Send All". Groups cost centres that share a supplier into ONE email (not separate emails per cost centre). Auto-attaches plans/specs.
2. Claude Vision OCR — upload quote PDF → extract: price ex GST, price inc GST, supplier name, quote date, expiry, scope items. Show for confirmation. Manual override on any field.
3. Email notification on quote receipt — to assigned estimator: "Quote received — {trade} — {job_code}"
4. Milestone notification — email to admin (configurable) when ALL trades for a job have at least one received quote: "{job_code} is fully quoted and ready for tender compilation"
5. Quote expiry tracking — flag in kanban + dashboard. Configurable 30/60/90 day warning.

**Phase 3 done when:** Bulk send groups suppliers correctly, OCR extracts prices, notifications fire on receipt and milestone, expiry flags show.

### Phase 4 — Intelligence
1. Supplier scraper — Google Places API by trade + region. Auto-add as "unverified". Deduplicate by email.
2. Auto follow-up emails — 1st at 7 days, 2nd at 14 days (configurable in settings). Separate follow-up template. Auto-sends via Graph API. After 2nd with no response → card turns red.
3. Price comparison table — per trade per job. Columns: Supplier | Price ex GST | Price inc GST | Markup % | Sell Price | Date | Expiry | Notes. Highlight cheapest. Flag expired. Export as PDF.
4. Historical pricing — query across all jobs: "what did we pay for {trade} across last N jobs?"
5. Supplier profile view — per supplier across ALL jobs: total requests, responses, response rate %, avg response days, avg price by trade, full quote history timeline
6. Estimator workload dashboard — pending/received/overdue counts per estimator

**Phase 4 done when:** Scraper returns results, follow-ups auto-send, comparison shows markup/sell price, supplier profiles show cross-job stats.

### Phase 5 — Polish
1. PWA manifest + service worker for "install to home screen"
2. Offline mode with IndexedDB cache + OneDrive sync (last-write-wins + conflict log as defined above)
3. Mobile touch optimisation — 44px+ targets, swipe on kanban, pull-to-refresh
4. PDF export for price comparisons
5. Final UI polish — consistent branding, loading states, error handling, empty states
6. End-to-end test: create job → add suppliers → send quotes → receive quote → OCR extract → compare prices → export PDF

**Phase 5 done when:** App installs as PWA on Samsung tablet, works offline, all flows complete without errors.

---

## Data Model

### types/index.ts

```typescript
// Trade / Cost Centre
interface Trade {
  code: string;        // "110"
  name: string;        // "CONCRETE SUPPLY"
  quotable: boolean;   // true (false for Preliminaries, Contingency, Sale Estimating)
  group?: string;      // Optional grouping key — e.g. "concrete" groups 110+115
}

// Supplier
interface Supplier {
  id: string;
  company: string;
  contact: string;
  email: string;
  phone: string;
  abn?: string;
  trades: string[];        // Cost centre codes: ["110", "115"]
  regions: string[];       // ["Western", "Northern"]
  status: "verified" | "unverified" | "blacklisted";
  rating: number;          // 1-5
  notes: string;
  lastContacted?: string;  // ISO date
  // Cross-job stats (calculated at read time, not stored)
  totalRequests?: number;
  totalResponses?: number;
  responseRate?: number;   // percentage
  avgResponseDays?: number;
}

// Estimator
interface Estimator {
  id: string;
  name: string;
  email: string;
  phone: string;
  signature: string;       // Plain text or HTML
  microsoftAccount: string; // For Graph API send-as
}

// Quote (per supplier per trade per job)
interface Quote {
  supplierId: string;
  supplierName: string;
  status: "not_started" | "requested" | "received" | "accepted" | "declined";
  requestedDate?: string;
  receivedDate?: string;
  priceExGST?: number;
  priceIncGST?: number;
  quoteExpiry?: string;
  quotePDF?: string;       // Filename in /Quotes/ folder
  version: number;         // 1, 2, 3... for revised quotes
  fileHash?: string;       // SHA-256 of uploaded PDF for duplicate detection
  followUpCount: number;
  lastFollowUp?: string;
  ocrExtracted?: boolean;  // true if price came from OCR
  scopeItems?: string[];   // Items extracted by OCR
}

// Job Document (link or uploaded file reference)
interface JobDocument {
  category: "architectural" | "engineering" | "scope" | "colour_selection" | "energy_rating" | "other";
  name: string;
  type: "link" | "upload";
  url?: string;            // If type=link
  fileName?: string;       // If type=upload
}

// Job
interface Job {
  jobCode: string;         // "BIR40"
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
  budgetEstimate?: number; // From Databuild BOQ total
  documents: JobDocument[];
  trades: {
    code: string;
    name: string;
    quotes: Quote[];
  }[];
  conflicts?: {
    timestamp: string;
    overwrittenBy: string;
    previousData: any;
  }[];
  createdAt: string;
  updatedAt: string;
}

// Email Template
interface EmailTemplate {
  id: string;
  tradeCodes: string[];    // Can apply to multiple grouped cost centres
  name: string;
  subject: string;         // With placeholders
  body: string;            // With placeholders
  type: "request" | "followup_1" | "followup_2" | "acceptance" | "decline";
}
```

### Quote File Naming Convention
```
{trade_name}_quote_by_{supplier_name}_v{version}.pdf
```
Examples:
- `concrete_supply_quote_by_EcoConcrete_v1.pdf`
- `concrete_supply_quote_by_EcoConcrete_v2.pdf`  ← revised quote
- `plumbing_quote_by_JustPlumb_v1.pdf`

Spaces replaced with underscores. All lowercase.

### Cost Centre Grouping
Some cost centres share suppliers and should send ONE combined email:
```typescript
const TRADE_GROUPS: Record<string, string[]> = {
  "concrete": ["110", "115"],
  "frame": ["145", "150", "155", "190"],
  "external_lockup": ["285", "290"],
  "fix": ["425", "430"],
  "fitoff": ["535", "540"],
  "tiling": ["435", "440"],
};
```

---

## Trade / Cost Centre Master List (from Databuild — GARRT833)

The full 58-entry array is defined in the spec file `RENIFY_QUOTE_PLATFORM_V2_SPEC.md` under section 5. Copy it verbatim into `src/data/trades.ts` during Phase 1 Component 4.

---

## Security & Infrastructure Rules

1. **OCR calls are server-side only.** Claude Vision API calls go through `/api/ocr`. The `ANTHROPIC_API_KEY` must NEVER appear in client-side code. Frontend uploads PDF to the API route, API route calls Claude, returns extracted data.

2. **Auto follow-ups use Vercel Cron Jobs.** Create `/api/cron/follow-ups` with a `CRON_SECRET` env var for auth. Configure in `vercel.json` to run daily at 8am UTC. The cron checks all active jobs for overdue quote requests and sends follow-ups via Graph API.

3. **Bulk email rate limiting.** Add 1-second delay between Graph API mail sends. On 429 (throttled), respect the `Retry-After` header. Log failed sends for manual retry.

4. **All API keys in env vars only.** Never hardcode keys. Never import env vars in client components.

---

## Rules
- Mobile-first: every component must work on Samsung tablets
- Touch targets: minimum 44px height on all interactive elements
- All data persists to OneDrive JSON files (no external database)
- Brand colour #2D5E3A for primary actions, dark sidebar
- Quote files named: `{trade}_quote_by_{supplier}_v{version}.pdf`
- ALL emails sent via Microsoft Graph API (no mailto: links anywhere)
- Cost centres in the same group send ONE combined email to shared suppliers
- Duplicate uploads detected by SHA-256 file hash
- Quote versioning: _v1, _v2, _v3 for revised quotes from same supplier
- Supplier CSV import supported for bulk onboarding
- Supplier profile tracks cross-job stats (requests, responses, avg response time)
- Dashboard shows cost summary per job (total quoted vs budget)
- Milestone notification when all trades for a job are quoted
- Never skip the CHECK step in the build workflow
- If CHECK fails 3+ times on the same issue, rethink the approach entirely
