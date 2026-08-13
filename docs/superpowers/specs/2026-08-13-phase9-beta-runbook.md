# Phase 9 — Beta runbook

Date: 2026-08-13
Status: ENTRY — blocked on human decisions/accounts listed below; everything
code-side is ready (Phases 1–8 complete, suite at 135 tests + live RLS drill).

## Step 0 — What already works today (no deployment)

- Founder beta on this machine: `npm run web` (any port) against the live
  Supabase project. Sign-in, households, money, grocery, retail all live.
- Spouse-on-same-WiFi beta: Expo Go on a phone pointed at the dev server
  (`npx expo start`, scan the QR). Same backend, same data.

## Step 1 — Web beta (first real deployment)

1. **Decide a host** for the static web build (any static host works; the
   build is `npx expo export --platform web` → `dist/`). Candidates:
   Cloudflare Pages / Netlify / Vercel — all have free tiers. **[HUMAN: pick
   one + create account]**
2. Deploy `dist/`, note the URL (e.g. `https://app.example.com`).
3. **Supabase auth settings** (dashboard → Auth → URL Configuration):
   - Site URL → the deployed URL (today it is `http://localhost:3000`).
   - Redirect allow-list → add `<url>` and `<url>/reset-password`.
4. Smoke: sign-up with a fresh email, confirm, sign in, create household,
   invite the spouse's email, spouse accepts on their device.

## Step 2 — Native beta

- **Apple**: Apple Developer account ($99/yr) → EAS Build → TestFlight.
- **Google**: Play Console account ($25 once) → EAS Build → internal testing
  track.
- Both use `eas build` / `eas submit` (Expo account needed; EAS free tier is
  fine for this volume). **[HUMAN: accounts]**
- Before store builds: app icon/splash are still Expo defaults — needs a
  design pass; bundle identifiers must be chosen in `app.json`.

## Step 3 — Beta-quality gates (from Phase 8 deferrals)

- **Crash monitoring**: create a Sentry account → `npx expo install
  @sentry/react-native` + wire in `app/_layout.tsx`. Do this BEFORE inviting
  non-family testers.
- **Backup review**: Supabase dashboard → Database → Backups; free tier has
  daily backups, PITR needs Pro. Decide before real financial data grows.
- **Payment tests + 6b billing**: store accounts above unblock 6b (Apple IAP /
  Play Billing / Stripe web), which then unblocks payment tests.

## Known cosmetic backlog (fine for beta, listed for honesty)

- Auth screens show the title twice on web (native header + in-screen title).
- More-tab avatar initials derive from the email local-part, not display name.
- Native data-export shares JSON as text (upgrade to expo-sharing when needed).
