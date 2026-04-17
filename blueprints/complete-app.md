# Blueprint: Complete Remaining App Features

## Problem Statement
The app has Phase 1 (Foundation) built, bulk email sending works, but several core features are missing: no way to receive/record quotes, no template editor, no estimator management, no price comparison, and the cron follow-up endpoint is stubbed.

## Approach
Build the missing features in priority order — quote intake first (it's the core workflow gap), then template editor, estimators, price comparison, and cron fix. Each task is self-contained and proven before moving on.

## Current State
- Data layer: Supabase (qp_jobs, qp_suppliers, qp_estimators, qp_email_templates, qp_settings)
- File storage: OneDrive via Graph API
- Auth: NextAuth with Azure AD, per-user tokens
- Sidebar: Dashboard, Jobs, Suppliers, Send Quotes (4 items + settings gear)
- Libraries built but no UI: quote-utils.ts, notifications.ts, pdf-export.ts, ocr route

## Task List

### Task 1: Quote Intake Page — Receive & Record Quotes
**Description:** Create /quotes/intake page where estimators record received quotes: select job, select trade, select supplier, upload PDF, enter price, trigger OCR, detect duplicates. This wires up quote-utils.ts, OCR, and notifications.
**Files:** src/app/quotes/intake/page.tsx (CREATE), src/app/api/quotes/receive/route.ts (CREATE)
**Proof:** BUILD — npm run build passes, page exists at /quotes/intake

### Task 2: Add Quote Intake to Sidebar
**Description:** Add "Receive Quote" as 5th sidebar item (between Suppliers and Send Quotes), using FileInput icon. Update MobileNav too.
**Files:** src/components/layout/Sidebar.tsx, src/components/layout/MobileNav.tsx
**Proof:** BUILD + grep "Receive Quote" in both files

### Task 3: Template Editor Page
**Description:** Create /templates page for CRUD on email templates. Edit subject/body with placeholder buttons, live preview using getSampleContext(), trade code multi-select. Seeds defaults if none exist.
**Files:** src/app/templates/page.tsx (CREATE)
**Proof:** BUILD — npm run build passes

### Task 4: Estimator Management Page
**Description:** Create /estimators page with CRUD for estimators (name, email, phone, signature, Microsoft account). Simple table + dialog form like suppliers page.
**Files:** src/app/estimators/page.tsx (CREATE)
**Proof:** BUILD — npm run build passes

### Task 5: Price Comparison Page
**Description:** Create /compare page. Select job + trade, see table of all received quotes with price ex GST, inc GST, markup %, sell price, date, expiry, version. Highlight cheapest. Show historical pricing from other jobs. Export PDF button using pdf-export.ts.
**Files:** src/app/compare/page.tsx (CREATE)
**Proof:** BUILD — npm run build passes

### Task 6: Update Sidebar — Add Templates, Estimators, Compare
**Description:** Expand sidebar to 7 items: Dashboard, Jobs, Suppliers, Receive Quote, Send Quotes, Compare, Templates. Add Estimators to settings area or as 8th item. Keep it clean.
**Files:** src/components/layout/Sidebar.tsx, src/components/layout/MobileNav.tsx
**Proof:** BUILD + grep all nav labels in both files

### Task 7: Fix Cron Follow-Up GET Endpoint
**Description:** The GET endpoint for Vercel Cron is stubbed. Fix it to use the POST logic but get the access token from a stored refresh token in Supabase settings (or env var). If no token available, log warning and skip.
**Files:** src/app/api/cron/follow-ups/route.ts
**Proof:** BUILD — npm run build passes

### Task 8: Integration Check + Deploy
**Description:** Run full build, verify all pages load, deploy to Vercel production.
**Proof:** npm run build passes, npx vercel --prod succeeds, curl -I returns 200

## Risk Flags
- Quote intake OCR depends on ANTHROPIC_API_KEY being set in env
- Cron follow-up needs a service account token strategy
- Template editor needs to handle the case where no templates exist yet (seed defaults)
