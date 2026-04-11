# Renify Quote Platform v2 — Full Spec

## Vision
A browser-based quoting platform that lives on top of your OneDrive folder structure. No external databases — your OneDrive IS the database. Every job, every quote lives in a standardised folder on OneDrive, and the app reads/writes directly to it via Microsoft Graph API. Works offline with local sync.

---

## 1. OneDrive Folder Structure (Simplified)

One folder per job, flat structure. No nested subfolders beyond Quotes.

```
📁 Renify Jobs/
  📁 BIR40 - 40 Birmingham St Spotswood/
    📁 Quotes/        ← ALL received quotes go here, named descriptively
    📄 job-config.json
  📁 GARRT833 - Lot 833 Garrett St Huntly/
    📁 Quotes/
    📄 job-config.json
  📄 suppliers.json     ← master supplier list (at root)
  📄 estimators.json    ← estimator directory (at root)
  📄 templates.json     ← email templates (at root)
  📄 settings.json      ← app settings (at root)
```

**Quote file naming convention (with versioning):**
```
{trade_name}_quote_by_{supplier_name}_v{version}.pdf
```
Examples:
- `concrete_supply_quote_by_EcoConcrete_v1.pdf`
- `concrete_supply_quote_by_EcoConcrete_v2.pdf` ← revised quote
- `plumbing_quote_by_JustPlumb_v1.pdf`
- `electrician_quote_by_SparkBros_v1.pdf`

Spaces → underscores, all lowercase. Version auto-increments when same supplier+trade submits again.

**Plans, specs, engineering:** NOT stored in job folders. Estimator either pastes a link (OneDrive/Google Drive/Dropbox share link) or uploads the file into the app's storage. Keeps OneDrive job folders clean — just quotes and config.

**OneDrive folder naming:** `{JOB_CODE} - {Street Number} {Street Name} {Suburb}`

---

## 2. App Modules

### 2.1 Dashboard
- **Job cards** showing: job name, address, estimator, % quotes received vs outstanding
- **Traffic light system:** 🔴 No quotes received · 🟡 Partial · 🟢 All trades quoted
- **Overdue alerts:** "BIR40 — Plumbing quote requested 9 days ago, no response"
- **Quick stats:** Total active jobs, quotes pending, quotes received this week
- **Cost summary per job:** Total quoted cost vs budget estimate (from Databuild BOQ)
- **Milestone badge:** ✅ when all trades for a job have at least one received quote
- **Filter by:** estimator, region, job status

### 2.2 Jobs
**Create new job:** Job code, address, client name+contact, region (dropdown), build type (New Build / Dual Occ / Extension / Renovation), storeys (Single / Double / Triple), assigned estimator, target quote deadline, budget estimate (total from Databuild BOQ). On save → auto-creates OneDrive folder + /Quotes/ subfolder.

**Job detail view:**
- **Documents section:** Links to plans/specs/engineering (estimator pastes URLs or uploads files)
  - Architectural Plans (link or upload)
  - Engineering Plans (link or upload)
  - Scope of Works (link or upload)
  - Colour Selection (link or upload)
  - Energy Rating (link or upload)
- **Quotes folder:** Shows all received quotes from the OneDrive `/Quotes/` folder
- Trade checklist: which trades need quoting for this job (tick from master trade list)
- Quote progress bar per trade
- Cost summary: total quoted vs budget

### 2.3 Quote Board (Kanban)
**Columns:** Not Started → Requested → Received → Accepted → Declined

**Each card = one supplier × one trade × one job**
- Shows: supplier name, trade, date requested, days elapsed
- Colour coded: green < 7 days, yellow 7–14, red 14+
- Click card → see quote PDF, price, versions, supplier contact, email history
- Drag between columns to update status
- Filter by: job, trade, estimator, supplier

### 2.4 Supplier CRM
**Fields per supplier:** Company name, contact person, email, phone, ABN (optional), trades (multi-select cost centres), regions (multi-select), status (✅ Verified / ⚠️ Unverified / ❌ Blacklisted), rating (1-5 stars), notes, last contacted date.

**Supplier profile view (cross-job stats):**
- Total quote requests sent across ALL jobs
- Total responses received
- Response rate %
- Average response time in days
- Average price by trade
- Full quote history timeline with links to each quote PDF

**Supplier CSV import:** Upload CSV with columns: company, contact, email, phone, trade, region → bulk add. Deduplicates by email.

**Supplier scraper (Phase 4):** Search Google Places by trade + region → auto-add as ⚠️ Unverified. Deduplicate by email/ABN.

### 2.5 Email Centre
**All emails sent via Microsoft Graph API** — sends from the signed-in estimator's own Microsoft account. No mailto: links.

**Bulk send:** Select job → shows trades needing quotes. For each trade, shows relevant suppliers. Tick suppliers → "Send All". **Groups cost centres that share a supplier** into ONE email (e.g. supplier tagged with 110+115 gets one email covering Concrete Supply + Labour, not two separate emails). Auto-attaches plans/specs from job record.

**Individual send:** Same Graph API path, just one recipient. Pre-filled template.

**Email templates:** Custom per trade/cost centre (or per trade group). Placeholders: `{supplier}`, `{contact}`, `{job_name}`, `{job_code}`, `{address}`, `{trade}`, `{estimator_name}`, `{estimator_email}`, `{estimator_phone}`, `{signature}`. Template editor with live preview. Types: request, followup_1, followup_2, acceptance, decline.

**Auto follow-up:** 1st at 7 days, 2nd at 14 days (configurable). Separate follow-up template. Auto-sends via Graph API. After 2nd with no response → card turns red, estimator notified.

### 2.6 Quote Intake
**Manual intake:** Select job + trade + supplier → upload PDF or enter price. App auto-names file with version (`_v1`, `_v2`). Saves to `/Quotes/` on OneDrive.

**Duplicate detection:** SHA-256 hash of uploaded PDF. If hash matches existing file, warns user: "This file has already been uploaded."

**Quote versioning:** If same supplier + same trade already has a quote, new upload auto-increments version. Previous versions preserved. Quote card shows version history.

**OCR auto-extract (Phase 3):** Upload PDF → Claude Vision reads it → extracts: price ex GST, price inc GST, supplier name, quote date, expiry, scope items. Shows extracted data for confirmation. Manual override on any field.

**Email notification:** On quote receipt → email to assigned estimator: "Quote received — {trade} — {job_code}" with supplier name, price, OneDrive link.

**Milestone notification:** When ALL quotable trades for a job have at least one received quote → email to admin: "{job_code} is fully quoted and ready for tender compilation."

### 2.7 Price Comparison
- Select job → select trade → see all received quotes in table:
  - Supplier | Price ex GST | Price inc GST | **Markup %** | **Sell Price** | Date | Expiry | Notes
- Markup % configurable per trade (default from settings)
- Sell Price = Price ex GST × (1 + Markup%)
- Highlight cheapest in green, flag expired in red
- Export comparison as PDF
- **Historical comparison:** "Last N jobs, what did we pay for {trade}?" — table across jobs

### 2.8 Estimator Management
- Name, email, phone, email signature block
- Microsoft account (for Graph API send-as-user)
- Assigned jobs (auto-populated)
- Workload: X quotes pending, Y received, Z overdue

### 2.9 Settings
- OneDrive root folder path (e.g. `/Renify Jobs/`)
- Region list (manage dropdown options)
- Follow-up rules (days before 1st and 2nd auto follow-up)
- Quote expiry warning thresholds (30/60/90 days)
- Default markup % per trade
- Admin email for milestone notifications
- Sync conflicts viewer (Phase 5)

---

## 3. Tech Stack

| Layer | Tech | Why |
|---|---|---|
| Frontend | Next.js 14 + Tailwind + shadcn/ui | Fast, mobile-first, PWA capable |
| Auth | NextAuth.js + Microsoft MSAL | Multi-user consent, per-user tokens |
| File Storage | OneDrive via Microsoft Graph API | Existing file system IS the database |
| App Data | JSON files in OneDrive | No external DB needed |
| Offline Cache | IndexedDB (Phase 5) | Local cache, sync on reconnect |
| Sync Strategy | Last-write-wins + conflict log | Simple, practical for construction teams |
| OCR | Claude Vision API | Read quote PDFs, extract prices |
| Supplier Scraping | Google Places API | Find local trades |
| Email | Microsoft Graph API (all sends) | From estimator's own account |
| Notifications | Microsoft Graph API (email) | Quote receipt + milestone alerts |
| Hosting | Vercel | Free tier, global CDN |

---

## 4. Cost Centre Grouping

Some cost centres share suppliers. When sending quote requests, the app groups them into ONE email per supplier:

| Group Key | Cost Centres |
|---|---|
| concrete | 110 Concrete Supply + 115 Concrete Labour |
| frame | 145 Pre-Fab Wall + 150 Frame Hardware + 155 Timber Supply + 190 Frame Carpenter |
| external_lockup | 285 External Lockup Supply + 290 External Lockup Carpenter |
| fix | 425 Fix Supply + 430 Fix Carpenter |
| fitoff | 535 Fit Off Supply + 540 Fit Off Carpenter |
| tiling | 435 Tile Supply + 440 Tiler |

---

## 5. Trade / Cost Centre Master List (Databuild — GARRT833)

This MUST be pasted into `src/data/trades.ts` exactly:

```typescript
export const TRADES = [
  { code: "015", name: "PRELIMINARIES", quotable: false },
  { code: "025", name: "TEMPORARY FENCE", quotable: true },
  { code: "030", name: "SET OUT", quotable: true },
  { code: "035", name: "TOILET HIRE", quotable: true },
  { code: "040", name: "BIN HIRE", quotable: true },
  { code: "055", name: "EXCAVATION AND SOIL REMOVAL", quotable: true },
  { code: "070", name: "ELECTRICAL UNDERGROUND", quotable: true },
  { code: "075", name: "NBN UNDERGROUNDS", quotable: true },
  { code: "100", name: "CRUSHED ROCK", quotable: true },
  { code: "105", name: "REINFORCEMENT", quotable: true },
  { code: "110", name: "CONCRETE SUPPLY", quotable: true, group: "concrete" },
  { code: "115", name: "CONCRETE LABOUR", quotable: true, group: "concrete" },
  { code: "140", name: "TERMITE PROTECTION", quotable: true },
  { code: "145", name: "PRE-FABRICATED WALL", quotable: true, group: "frame" },
  { code: "150", name: "FRAME HARDWARE", quotable: true, group: "frame" },
  { code: "155", name: "TIMBER SUPPLY", quotable: true, group: "frame" },
  { code: "190", name: "FRAME CARPENTER", quotable: true, group: "frame" },
  { code: "195", name: "SISALATION", quotable: true },
  { code: "200", name: "FASCIA AND GUTTER", quotable: true },
  { code: "205", name: "METAL ROOFING", quotable: true },
  { code: "260", name: "FALL PROTECTION", quotable: true },
  { code: "270", name: "WINDOWS", quotable: true },
  { code: "275", name: "FLYSCREENS", quotable: true },
  { code: "285", name: "EXTERNAL LOCKUP SUPPLY", quotable: true, group: "external_lockup" },
  { code: "290", name: "EXTERNAL LOCKUP CARPENTER", quotable: true, group: "external_lockup" },
  { code: "310", name: "EXTERNAL FINISHES", quotable: true },
  { code: "315", name: "PLUMBER", quotable: true },
  { code: "320", name: "DOWNPIPES", quotable: true },
  { code: "325", name: "ELECTRICIAN", quotable: true },
  { code: "328", name: "ELECTRICAL SAFETY INSPECTION", quotable: true },
  { code: "370", name: "REFRIGERATION COOLING", quotable: true },
  { code: "380", name: "INSULATION", quotable: true },
  { code: "385", name: "PLASTERING", quotable: true },
  { code: "410", name: "WATERPROOFING", quotable: true },
  { code: "415", name: "JOINERY", quotable: true },
  { code: "420", name: "STONE BENCHTOPS", quotable: true },
  { code: "425", name: "FIX SUPPLY", quotable: true, group: "fix" },
  { code: "430", name: "FIX CARPENTER", quotable: true, group: "fix" },
  { code: "435", name: "TILE SUPPLY", quotable: true, group: "tiling" },
  { code: "440", name: "TILER", quotable: true, group: "tiling" },
  { code: "455", name: "CAULKING", quotable: true },
  { code: "460", name: "PAINTING", quotable: true },
  { code: "465", name: "GARAGE DOORS", quotable: true },
  { code: "470", name: "SHOWER SCREENS", quotable: true },
  { code: "475", name: "MIRRORS", quotable: true },
  { code: "480", name: "SHELVING", quotable: true },
  { code: "485", name: "SLIDING ROBE DOORS", quotable: true },
  { code: "495", name: "TAPWARE", quotable: true },
  { code: "500", name: "BATHROOM ACCESSORIES", quotable: true },
  { code: "505", name: "BATH AND SHOWER BASE", quotable: true },
  { code: "510", name: "LAUNDRY TUB", quotable: true },
  { code: "515", name: "TOILET SUITES", quotable: true },
  { code: "520", name: "SINKS AND BASINS", quotable: true },
  { code: "525", name: "APPLIANCES", quotable: true },
  { code: "530", name: "HOT WATER SYSTEMS", quotable: true },
  { code: "535", name: "FIT OFF SUPPLY", quotable: true, group: "fitoff" },
  { code: "540", name: "FIT OFF CARPENTER", quotable: true, group: "fitoff" },
  { code: "545", name: "CARPET", quotable: true },
  { code: "555", name: "FLOATING FLOOR", quotable: true },
  { code: "560", name: "BUILDER CLEAN", quotable: true },
  { code: "575", name: "DRIVEWAY & PAVING", quotable: true },
  { code: "605", name: "LETTER BOXES", quotable: true },
  { code: "620", name: "CLOTHESLINE AND LABOUR", quotable: true },
  { code: "630", name: "LANDSCAPING", quotable: true },
  { code: "640", name: "SITE CLEAN", quotable: true },
  { code: "650", name: "CONTINGENCY", quotable: false },
  { code: "900", name: "SALE ESTIMATING", quotable: false },
] as const;

export type TradeCode = typeof TRADES[number]["code"];
```

---

## 6. Security & Infrastructure Notes

### OCR API calls — server-side only
Claude Vision API calls for quote PDF extraction MUST go through a Next.js API route (`/api/ocr`). The Anthropic API key must NEVER be exposed client-side. The frontend uploads the PDF to the API route, which forwards it to Claude Vision and returns the extracted data.

### Auto follow-up scheduler
Auto follow-ups at 7 and 14 days require a scheduler. Vercel is serverless — no persistent process. Use **Vercel Cron Jobs** (supported on free tier):
- Create `/api/cron/follow-ups` API route
- Configure in `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/follow-ups", "schedule": "0 8 * * *" }
  ]
}
```
This runs daily at 8am UTC. The route checks all active jobs for quotes in "requested" status where `requestedDate + followUpDays <= today` and `followUpCount < 2`, then sends via Graph API.

Protect the cron endpoint with `CRON_SECRET` env var so it can't be triggered externally.

### Bulk email rate limiting
Microsoft Graph throttles mail sends. Bulk quote requests must queue with a **1-second delay between emails**. Implementation:
```typescript
for (const email of emailQueue) {
  await sendViaGraphAPI(email);
  await new Promise(resolve => setTimeout(resolve, 1000));
}
```
If a 429 (throttled) response is received, back off for the duration specified in the `Retry-After` header before continuing. Log any failed sends for manual retry.

---

*Spec v2.1 — April 2026 — Renify Building & Construction*
