# Renify Quote Platform — Launch Instructions

## Setup (one time, ~15 minutes)

### 1. Create project folder
```powershell
mkdir C:\Users\Zabi\Projects\renify-quote-platform
cd C:\Users\Zabi\Projects\renify-quote-platform
git init
```

### 2. Copy files into the project folder
Download from this chat and place in the project root:
- `CLAUDE.md`
- `RENIFY_QUOTE_PLATFORM_V2_SPEC.md`

### 3. Register Azure App (for OneDrive + Email API)
1. Go to https://portal.azure.com
2. Azure Active Directory → App registrations → New registration
3. Name: `Renify Quote Platform`
4. Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
5. Redirect URI → Web → `http://localhost:3000/api/auth/callback/microsoft`
6. After creation, go to API Permissions → Add:
   - Microsoft Graph → Delegated → `Files.ReadWrite.All`
   - Microsoft Graph → Delegated → `Mail.Send`
   - Microsoft Graph → Delegated → `User.Read`
7. Certificates & secrets → New client secret → copy the value
8. Note down: **Client ID** (from Overview), **Client Secret** (just created), **Tenant ID** (use `common`)

### 4. Create .env.local
Create file `C:\Users\Zabi\Projects\renify-quote-platform\.env.local`:
```
MICROSOFT_CLIENT_ID=paste_client_id_here
MICROSOFT_CLIENT_SECRET=paste_secret_here
MICROSOFT_TENANT_ID=common
NEXTAUTH_SECRET=renify-quote-2026-random-secret
NEXTAUTH_URL=http://localhost:3000
ANTHROPIC_API_KEY=paste_your_key
GOOGLE_PLACES_API_KEY=paste_if_you_have_one
```

---

## Launch the Build

### 5. Open Claude Code
```powershell
cd C:\Users\Zabi\Projects\renify-quote-platform
claude
```

### 6. Paste this single prompt

```
Read CLAUDE.md and RENIFY_QUOTE_PLATFORM_V2_SPEC.md in this directory.

Follow the build workflow defined in CLAUDE.md exactly: PLAN → BUILD → CHECK → FIX → COMMIT for every component.

Start with Phase 1, Component 1. Work through every component in order. After each component passes all checks (tsc, lint, build), commit and move to the next.

After all Phase 1 components pass, run npm run dev and confirm the app loads. Then proceed to Phase 2, 3, 4, and 5 in sequence.

Do not stop between phases. Keep going until all 5 phases are complete or you hit something you need my input on.
```

---

## What Happens Next

Claude Code will work through the build sequentially:

1. Reads your spec and CLAUDE.md
2. Plans Phase 1 Component 1 (project scaffold)
3. Builds it
4. Runs tsc + lint + build to verify
5. Fixes any issues
6. Commits to git
7. Moves to Component 2
8. Repeats through all 12 Phase 1 components
9. Starts Phase 2 automatically
10. Continues through all 5 phases

### What you do:
- Watch it work
- Answer questions if it asks (e.g. Azure credentials)
- Test in browser between phases: http://localhost:3000
- If it gets stuck, paste the error and say "fix this"

### Time estimate:
~4-6 hours total across all phases. You can stop between phases and resume later — the git commits preserve progress.

---

## After Build: Deploy to Vercel

Once all phases pass locally:

```
Deploy this Next.js app to Vercel. Create a GitHub repo zabiz1239-collab/renify-quote-platform, push the code, connect to Vercel. Set environment variables. Give me the live URL.
```

Then update the Azure app redirect URI to include the Vercel production URL alongside localhost.
