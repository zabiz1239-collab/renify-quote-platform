# Blueprint: Simplify V2 — Pre-Deploy Fixes

## Problem Statement
8 sanity checks were run before deploy. 5 hard-failed, 2 partial-failed. The sidebar has 10 items (should be 4), there's no settings gear icon, the job detail page has no upload zones, the suppliers page has no "Find Local Trades" scraper modal, the /quotes page is still a Kanban board instead of the Send Quotes flow, and the email API doesn't attach PDFs or use the correct subject format.

## Solution Approach
Fix each failing check in 5 sequential phases. Each phase is self-contained — if a phase breaks, we roll back just that phase's commits. No new files unless absolutely necessary; modify existing files wherever possible.

---

## Phase 1: Sidebar + Settings Gear + Header

**Goal:** Sidebar shows exactly 4 items (Dashboard, Jobs, Suppliers, Send Quotes). A settings gear icon appears in the top-right of the header on both desktop and mobile.

### Files to change

| File | Action | Reason |
|------|--------|--------|
| `src/components/layout/Sidebar.tsx` | MODIFY | Strip nav array to 4 items, remove unused icon imports |
| `src/components/layout/MobileNav.tsx` | MODIFY | Same 4-item nav array, add gear icon in top bar |
| `src/components/layout/AuthLayout.tsx` | MODIFY | Add a top header bar on desktop with settings gear icon linking to /settings |

### Diff summary

**Sidebar.tsx:**
- Remove: `Kanban, FileText, BarChart3, Activity, Rocket, Settings, Users` icon imports
- Replace 10-item `navItems` array with 4 items:
  ```
  { href: "/", label: "Dashboard", icon: LayoutDashboard }
  { href: "/jobs", label: "Jobs", icon: Briefcase }
  { href: "/suppliers", label: "Suppliers", icon: Truck }
  { href: "/quotes", label: "Send Quotes", icon: Mail }
  ```
- Add `Mail` to lucide imports (replacing removed icons)

**MobileNav.tsx:**
- Same navItems reduction to 4 items
- Remove unused icon imports
- Add a `Settings` gear icon (lucide) next to the hamburger menu in the top bar, linking to `/settings`

**AuthLayout.tsx:**
- Add a thin header bar above `<main>` on desktop: `<div className="flex items-center justify-end p-4 border-b">` with a `<Link href="/settings"><Settings className="w-5 h-5" /></Link>`
- Import `Link` from next/link and `Settings` from lucide-react

### Verification

```bash
# Sidebar has exactly 4 navItems
grep -c "href:" src/components/layout/Sidebar.tsx
# Expected: 4

# No banned items in Sidebar
grep -E "Compare|Templates|Estimators|Workload|Setup Guide|Quote Board" src/components/layout/Sidebar.tsx
# Expected: no output (exit code 1)

# Same check for MobileNav
grep -c "href:" src/components/layout/MobileNav.tsx
# Expected: 4 (nav items) + 1 (settings gear link) = check navItems array specifically

grep -E "Compare|Templates|Estimators|Workload|Setup Guide|Quote Board" src/components/layout/MobileNav.tsx
# Expected: no output

# Settings gear exists in AuthLayout or MobileNav
grep "Settings" src/components/layout/AuthLayout.tsx
# Expected: matches for Settings icon import + usage

grep "/settings" src/components/layout/AuthLayout.tsx
# Expected: matches for href="/settings"

# Build
npm run build
npx tsc --noEmit
```

### Rollback
```bash
git log --oneline -3  # Find the Phase 1 commit
git revert <commit-hash>
```

---

## Phase 2: Job Detail Upload Zones

**Goal:** The job detail page at `/jobs/[jobCode]` shows 5 upload zones (Plans, Engineering, Inclusions, Colour Selection, Other). Each zone accepts file uploads and stores them in OneDrive at `/Renify Jobs/{jobCode} - {address}/{category}/`.

### Files to change

| File | Action | Reason |
|------|--------|--------|
| `src/app/jobs/[jobCode]/page.tsx` | MODIFY | Add 5 upload zone cards after the existing Documents card |
| `src/app/api/upload/route.ts` | CREATE | Server-side API route to receive file + upload to OneDrive via Graph API |

### Diff summary

**page.tsx:**
- Add a new `DocumentUploadZones` section below the existing Documents card
- 5 zones, each with a category label ("Plans", "Engineering", "Inclusions", "Colour Selection", "Other")
- Each zone has a file `<input type="file">` wrapped in a drop-target styled card
- On file select, POST to `/api/upload` with `{ jobCode, address, category, file }` as FormData
- Show upload progress/spinner per zone
- After upload success, reload job data to show new document in the Documents list
- Import `Upload` icon from lucide-react

**api/upload/route.ts (NEW):**
- Accept POST with multipart FormData: file, jobCode, address, category
- Auth check via `getServerSession`
- Get settings from Supabase to find `oneDriveRootPath`
- Upload file to OneDrive path: `{rootPath}/{jobCode} - {address}/{category}/{filename}`
- Create folder if it doesn't exist first
- Update job's `documents` array in Supabase with the new file reference
- Return `{ success: true, fileName }`

### Verification

```bash
# Upload zones exist in job detail page
grep -c "upload" src/app/jobs/\[jobCode\]/page.tsx
# Expected: multiple matches

# All 5 categories present
grep -E "Plans|Engineering|Inclusions|Colour Selection|Other" src/app/jobs/\[jobCode\]/page.tsx
# Expected: all 5 present

# Upload API route exists
test -f src/app/api/upload/route.ts && echo "EXISTS" || echo "MISSING"
# Expected: EXISTS

# API route uses OneDrive upload
grep "uploadFile\|createFolder" src/app/api/upload/route.ts
# Expected: matches

# Build
npm run build
npx tsc --noEmit
```

### Rollback
```bash
git revert <phase-2-commit>
rm src/app/api/upload/route.ts  # if revert doesn't clean new files
```

---

## Phase 3: Suppliers "Find Local Trades" Modal

**Goal:** The suppliers page has a "Find Local Trades" button. Clicking it opens a modal with: trade dropdown, region dropdown, Search button, results list with checkboxes, "Add Selected" button. It calls the existing `/api/scraper` endpoint.

### Files to change

| File | Action | Reason |
|------|--------|--------|
| `src/app/suppliers/page.tsx` | MODIFY | Add "Find Local Trades" button + scraper modal with trade/region dropdowns, search, results, add selected |

### Diff summary

**suppliers/page.tsx:**
- Add `Search` icon import from lucide-react
- Add new state: `scraperOpen`, `scraperTrade`, `scraperRegion`, `scraperResults`, `scraperLoading`, `selectedResults` (Set of indices)
- Add a "Find Local Trades" button next to "Add Supplier" button
- Add a new `<Dialog>` for the scraper modal:
  - Trade dropdown (uses `TRADES.filter(t => t.quotable)`, shows code + name)
  - Region dropdown (uses `DEFAULT_REGIONS`)
  - "Search" button — calls `POST /api/scraper` with `{ trade, region }`
  - Results list — each result is a row with checkbox, company name, phone, website
  - "Add Selected" button — converts checked results to Supplier objects, saves via `saveSuppliersBulk`, refreshes list, closes modal
- No new files needed — the `/api/scraper` route already exists and works

### Verification

```bash
# "Find Local Trades" button exists
grep "Find Local Trades" src/app/suppliers/page.tsx
# Expected: 1 match

# Scraper modal state variables exist
grep -E "scraperOpen|scraperTrade|scraperRegion|scraperResults" src/app/suppliers/page.tsx
# Expected: multiple matches

# Modal calls the scraper API
grep "/api/scraper" src/app/suppliers/page.tsx
# Expected: at least 1 match

# "Add Selected" button exists
grep "Add Selected" src/app/suppliers/page.tsx
# Expected: 1 match

# Build
npm run build
npx tsc --noEmit
```

### Rollback
```bash
git revert <phase-3-commit>
```

---

## Phase 4: Send Quotes Flow (Replace Kanban)

**Goal:** `/quotes` is no longer a Kanban board. It becomes the "Send Quotes" page with flow: Job picker dropdown -> Trade chips (multi-select) -> Supplier panels with checkboxes (filtered by selected trades + job region) -> "Preview & Send" button that calls `/api/email/bulk`.

### Files to change

| File | Action | Reason |
|------|--------|--------|
| `src/app/quotes/page.tsx` | MODIFY | Complete rewrite — replace Kanban with Send Quotes flow |
| `src/components/quotes/KanbanBoard.tsx` | DELETE | No longer used anywhere |

### Diff summary

**quotes/page.tsx (REWRITE):**
- Remove: KanbanBoard import, all kanban-related state and logic
- New page title: "Send Quotes" (not "Quote Board")
- New flow:
  1. **Job picker**: `<Select>` dropdown loading jobs from `getJobs()`. On select, load job details.
  2. **Trade chips**: Show job's trades as toggle chips. User clicks to select which trades to quote. Multi-select.
  3. **Supplier panels**: For each selected trade, show suppliers that match (supplier.trades includes trade code AND supplier.regions includes job.region). Each supplier row has a checkbox.
  4. **Preview & Send button**: Enabled when at least 1 supplier is checked. On click, build selections array `[{supplierId, tradeCodes}]` and POST to `/api/email/bulk` with `{jobCode, selections}`.
  5. Show send results (success/fail per supplier) in a summary after send completes.
- Load suppliers from `getSuppliers()` on mount
- Import `Send, Check` from lucide-react (replacing `Kanban`)

**KanbanBoard.tsx (DELETE):**
- This component is only imported by `quotes/page.tsx`. After the rewrite, nothing uses it.

### Verification

```bash
# Page title is "Send Quotes" not "Quote Board"
grep "Send Quotes" src/app/quotes/page.tsx
# Expected: at least 1 match

grep "Quote Board\|Kanban" src/app/quotes/page.tsx
# Expected: no output (exit code 1)

# KanbanBoard is deleted
test -f src/components/quotes/KanbanBoard.tsx && echo "STILL EXISTS" || echo "DELETED"
# Expected: DELETED

# No remaining imports of KanbanBoard anywhere
grep -r "KanbanBoard" src/
# Expected: no output

# Supplier filtering exists
grep "supplier.*trades\|supplier.*regions" src/app/quotes/page.tsx
# Expected: matches showing supplier filtering logic

# Calls bulk email API
grep "/api/email/bulk" src/app/quotes/page.tsx
# Expected: at least 1 match

# Build
npm run build
npx tsc --noEmit
```

### Rollback
```bash
git revert <phase-4-commit>
# KanbanBoard.tsx will need to be restored from git:
git checkout HEAD~1 -- src/components/quotes/KanbanBoard.tsx
```

---

## Phase 5: Email Backend — PDF Attachments + Subject Fix

**Goal:** The bulk email API pulls PDFs from the job's OneDrive folder and attaches them to the outgoing email via Graph API. Subject line is always `"Quote Request — {trade} — {jobAddress}"` generated server-side (not template-dependent).

### Files to change

| File | Action | Reason |
|------|--------|--------|
| `src/app/api/email/bulk/route.ts` | MODIFY | Add OneDrive PDF download + Graph API attachment, hardcode subject format |

### Diff summary

**route.ts:**
- After loading job data, fetch files from OneDrive folder: `{rootPath}/{jobCode} - {address}/Plans/` (and Engineering, Inclusions)
- For each PDF file found, download content via `downloadFile()` and convert to base64
- Build attachments array: `[{ name, contentType: "application/pdf", contentBytes: base64 }]`
- Pass attachments to `sendEmail()` call (the `sendEmail` function already accepts `attachments` param)
- Replace template-rendered subject with hardcoded format: `"Quote Request — {tradeDisplay} — {job.address}"`
- Keep template for body content only
- Import `listFolder`, `downloadFile` from `@/lib/onedrive`
- Import `getSettings` from `@/lib/supabase` (to get `oneDriveRootPath`)
- Add `getTradeDisplayName` import from `@/lib/templates`

### Verification

```bash
# PDF attachment logic exists
grep -E "attachment|contentBytes|base64" src/app/api/email/bulk/route.ts
# Expected: multiple matches

# Downloads from OneDrive
grep -E "downloadFile|listFolder" src/app/api/email/bulk/route.ts
# Expected: matches

# Hardcoded subject format
grep "Quote Request" src/app/api/email/bulk/route.ts
# Expected: match showing the hardcoded subject template

# Still uses sendEmail with attachments
grep "sendEmail" src/app/api/email/bulk/route.ts
# Expected: match

# Build
npm run build
npx tsc --noEmit
```

### Rollback
```bash
git revert <phase-5-commit>
```

---

## File Change Summary (All Phases)

| File | Phase | Action |
|------|-------|--------|
| `src/components/layout/Sidebar.tsx` | 1 | MODIFY — reduce to 4 nav items |
| `src/components/layout/MobileNav.tsx` | 1 | MODIFY — reduce to 4 nav items, add settings gear |
| `src/components/layout/AuthLayout.tsx` | 1 | MODIFY — add desktop header with settings gear |
| `src/app/jobs/[jobCode]/page.tsx` | 2 | MODIFY — add 5 upload zones |
| `src/app/api/upload/route.ts` | 2 | CREATE — OneDrive file upload endpoint |
| `src/app/suppliers/page.tsx` | 3 | MODIFY — add Find Local Trades button + scraper modal |
| `src/app/quotes/page.tsx` | 4 | MODIFY — rewrite from Kanban to Send Quotes flow |
| `src/components/quotes/KanbanBoard.tsx` | 4 | DELETE — no longer used |
| `src/app/api/email/bulk/route.ts` | 5 | MODIFY — add PDF attachments, fix subject |

**Total: 7 modified, 1 created, 1 deleted = 9 files touched**

---

## Risk Flags

1. **Phase 2 (uploads):** Relies on user having a valid OneDrive access token in session. If token is expired, upload will fail with 401. The existing token refresh logic should handle this, but worth testing manually.
2. **Phase 4 (Kanban delete):** If any other page secretly imports KanbanBoard, the build will break. Grep check covers this.
3. **Phase 5 (PDF attach):** OneDrive folder might be empty (no plans uploaded yet). The code must handle this gracefully — send email without attachments if no PDFs found, not crash.
4. **Phase 5 (PDF size):** Graph API has a 4MB limit per attachment via the simple upload path. Large PDF plans could exceed this. For now, skip files > 3MB and log a warning. Future fix: use the resumable upload API.
