# Blueprint — Bug Fix Sprint #2: 22 Issues

## Problem Statement
Post-deployment testing revealed 22 bugs across critical, medium, and UX severity levels. The most impactful are: broken Add buttons (Suppliers/Estimators), layout whitespace, missing form validation, sidebar nav issues, and mobile menu problems. OneDrive connection errors (bugs 1, 4, 6) are root-caused by missing folder setup — deferred to the OneDrive V2 feature blueprint.

## Solution Approach
Fix bugs in priority order: functional blockers first (Add buttons, validation, layout), then medium (sidebar, mobile, inputs), then UX polish (page titles, breadcrumbs, accessibility). Each task groups related bugs.

## Current State Snapshot
- All phases + bug fix sprint #1 complete (Tasks 1-7 proven)
- Build passes: `tsc --noEmit`, `next lint`, `npm run build` all green
- Core issue: DialogTrigger + controlled state conflict breaks Add buttons
- Layout uses flex but missing `min-h-0` causes overflow issues

## Task List

### Task 1: Fix broken Add buttons — Suppliers, Estimators, Templates (Bug 2)
- **Description**: The `DialogTrigger asChild` wrapping a `Button onClick={openCreate}` creates a double-toggle: `openCreate` sets `dialogOpen=true`, then `DialogTrigger` toggles it back to `false`. Fix by removing `DialogTrigger` wrapper and using the Button's `onClick` directly to set `dialogOpen=true`. Keep the `Dialog` with `open={dialogOpen} onOpenChange={setDialogOpen}` for controlled state. Same pattern on all three pages.
- **Files**: `src/app/suppliers/page.tsx`, `src/app/estimators/page.tsx`, `src/app/templates/page.tsx`
- **Proof**: BUILD — `npm run build` succeeds

### Task 2: Fix layout whitespace + sidebar scroll (Bugs 3, 7)
- **Description**: Add `min-h-0` to the flex children in AuthLayout to prevent flex items from overflowing. The `flex-1 flex flex-col` div needs `min-h-0` so `overflow-y-auto` on main works correctly. Verify sidebar stays visible when scrolling page content.
- **Files**: `src/components/layout/AuthLayout.tsx`
- **Proof**: BUILD — `npm run build` succeeds

### Task 3: Add form validation with field-level feedback (Bug 5)
- **Description**: On Create Job form, add field-level validation: red border + error text below each required field when empty on submit. Fields: Job Code, Address, Region, Build Type, Storeys, Client Name. Also add `required` HTML attribute for accessibility. Show error state on individual fields, not just a global error banner.
- **Files**: `src/app/jobs/new/page.tsx`
- **Proof**: BUILD — `npm run build` succeeds

### Task 4: Fix input validation — negative values, phone type, region default (Bugs 8, 9, 10)
- **Description**: (a) Budget estimate: add JS clamping `Math.max(0, ...)` on change, keep `min={0}`. (b) Markup %: add JS clamping `Math.max(0, Math.min(100, ...))`. (c) Phone fields: ensure `type="tel"` on all phone inputs across job form, supplier form, estimator form. (d) Region dropdown: ensure form state starts as empty string `""`, not pre-selected. Only submit if user explicitly picks one.
- **Files**: `src/app/jobs/new/page.tsx`, `src/app/compare/page.tsx`, `src/app/suppliers/page.tsx`, `src/app/estimators/page.tsx`
- **Proof**: BUILD — `npm run build` succeeds

### Task 5: Fix sidebar active state — Estimators vs Workload (Bug 21)
- **Description**: Change sidebar active logic: for items that have child routes (like `/estimators`), only highlight on exact match, NOT on `startsWith`. The workload page at `/estimators/workload` should only highlight "Workload", not both "Estimators" and "Workload". Fix: add an `exact` flag to nav items that have sub-routes, or compare against all nav items to find the most specific match.
- **Files**: `src/components/layout/Sidebar.tsx`, `src/components/layout/MobileNav.tsx`
- **Proof**: BUILD — `npm run build` succeeds

### Task 6: Fix mobile hamburger menu dimensions (Bug 11)
- **Description**: The hamburger button has `min-w-[44px] min-h-[44px]` but may be collapsing due to parent flex constraints. Add explicit `w-11 h-11` and ensure the parent flex container doesn't constrain it. Test that the button is visible and tappable.
- **Files**: `src/components/layout/MobileNav.tsx`
- **Proof**: BUILD — `npm run build` succeeds

### Task 7: Fix heading hierarchy on Compare page (Bug 12)
- **Description**: Compare page jumps from H1 to H3. Change H3 headings to H2 for proper accessibility hierarchy.
- **Files**: `src/app/compare/page.tsx`
- **Proof**: BUILD — `npm run build` succeeds

### Task 8: Add dynamic page titles (Bug 13)
- **Description**: Add page-specific `<title>` using Next.js metadata. Each page should show "[Page] — Renify" in the browser tab. Use Next.js `metadata` export for static pages, or `useEffect` with `document.title` for client pages.
- **Files**: `src/app/page.tsx`, `src/app/jobs/page.tsx`, `src/app/jobs/new/page.tsx`, `src/app/quotes/page.tsx`, `src/app/suppliers/page.tsx`, `src/app/estimators/page.tsx`, `src/app/templates/page.tsx`, `src/app/settings/page.tsx`, `src/app/compare/page.tsx`, `src/app/setup/page.tsx`
- **Proof**: BUILD — `npm run build` succeeds

### Task 9: Add skip-to-content link + breadcrumbs (Bugs 15, 20)
- **Description**: (a) Add a visually-hidden skip link at the top of AuthLayout: "Skip to content" that focuses the `<main>` element. (b) Add breadcrumb nav to Create Job page: "Jobs > New Job" with link back to jobs list.
- **Files**: `src/components/layout/AuthLayout.tsx`, `src/app/jobs/new/page.tsx`
- **Proof**: BUILD — `npm run build` succeeds

### Task 10: Improve trade selection UX (Bug 16)
- **Description**: Group the 58 trades by category in the Create Job form. Add a "Select All / None" toggle. Group headers: "Siteworks" (015-100), "Structure" (105-195), "External" (200-310), "Services" (315-370), "Internal" (375-530), "Finishes" (535-640), "Other" (700+). Each group is collapsible. Add a search/filter box above the list.
- **Files**: `src/app/jobs/new/page.tsx`
- **Proof**: BUILD — `npm run build` succeeds

### Task 11: Dashboard graceful empty state (Bug 19 + part of 1)
- **Description**: When OneDrive fails to load (any error), show a helpful message: "Couldn't connect to OneDrive. Check your connection or set up your jobs folder in Settings." with buttons to retry and go to settings. When folder is empty (no error but no jobs), show the existing "No jobs yet" card. Never show a raw error object.
- **Files**: `src/app/page.tsx`
- **Proof**: BUILD — `npm run build` succeeds

### Task 12: Final build verification + deploy
- **Description**: Run `tsc --noEmit`, `next lint`, `npm run build`. Fix any issues. Deploy with `npx vercel --prod`.
- **Files**: Any files needing fixes
- **Proof**: COMMAND — All checks pass, deploy succeeds

## Out of Scope (deferred)
- **Bugs 1, 4, 6**: OneDrive connection — requires folder picker feature (separate blueprint)
- **Bug 14**: Open Graph meta tags — low priority cosmetic
- **Bug 17**: Unsaved changes warning — needs `beforeunload` handler, moderate effort, low ROI
- **Bug 18**: Loading states — already has `PageSkeleton` component, issue is it shows error instead
- **Bug 22**: Cancel confirmation — low priority, could annoy users

## Approval Gate

Review this blueprint. Tell me:
- Blueprint OK → I start Task 1
- Change X → I update the blueprint and re-present

I will NOT touch any code until you approve.
