# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Global Household App** (internal codename) — a universal Expo app (iOS / Android / Web-PWA) for global household finance: budgeting, shared shopping, retail price intelligence, and multi-currency money, on a Supabase backend. One codebase; RLS is the security boundary; first-class multi-currency, i18n (English / Filipino / Arabic), and RTL.

Status: **Phases 1–8 are built and verified; Phase 9 (Beta) is entry-gated on external accounts** (web host, Apple/Google dev, Sentry) — see `context/build-plan.md#spec-2026-08-13-phase9-beta-runbook`. **All project context now lives in `context/` — start at `context/project-overview.md` (the full doc map is in `README.md` § "Project documentation").** Product intent and the money/security/globalization/retail rules are in `context/project-overview.md` and `context/architecture.md`; `context/build-plan.md` is the roadmap, with per-slice design specs and execution plans folded into its Appendices A/B (anchor forms `#spec-<stem>` / `#plan-<stem>`). (The former numbered `00_`–`11_*.md` root specs, and the separate `context/specs/` + `context/plans/` folders, were consolidated into `context/` and removed — recoverable from git history.)

## Commands

```bash
npm run typecheck        # tsc --noEmit (strict); run this after every change
npm test                 # jest-expo unit + component tests
npx jest tests/foo.test.ts          # a single test file
npx jest -t "substring of test name"  # a single test by name
npm run web              # Expo web (fastest way to see the app; opens a browser)
npm run android | ios    # native via Expo Go / simulator
npm run lint             # expo lint
```

**`npm run test:rls`** runs `tests/integration/rls-isolation.mjs` — a **live** standalone Node script (not jest) that hits the real Supabase project to prove household isolation across every table. It needs `SUPABASE_SERVICE_ROLE_KEY` in `.env` **temporarily** (used only to create/delete two test users). The drill: add the key → `npm run test:rls` → **remove the key**. It must never ship or live in `EXPO_PUBLIC_*`.

Path alias: `@/*` → repo root (e.g. `import { money } from '@/lib/money'`).

## Architecture (the big picture)

- **Routing:** Expo Router, file-based under `app/`. `app/_layout.tsx` is the root: it loads fonts (gate), then nests providers `AuthProvider → ActiveHouseholdProvider → EntitlementsProvider → RootNavigator`, and enforces the auth gate (redirect to `/login`). Tabs live in `app/(tabs)/`; feature stacks in `app/<domain>/`.
- **Feature modules — `features/<domain>/`** (auth, household, finance, grocery, retail, billing). Each owns its `api.ts` (data access), `schemas.ts` (zod), and pure helpers. **The data-access boundary is strict: screens never call `getSupabase()` directly — only `features/*/api.ts` does.** Query results are cast to the hand-maintained types in `lib/database.types.ts` at that boundary (the Supabase client is intentionally schema-agnostic).
- **Shared libs — `lib/`:** `money.ts` (the money engine), `format.ts` (locale/timezone display via `Intl`), `fonts.ts` (typography faces + resolver), `rtl.ts`, `supabase.ts` (client; null until `.env` configured — use `getSupabase()`), `errors.ts` (`AppError` + `toAppError`), `validation.ts` (`validate(schema, input)`), `i18n.ts`, `database.types.ts`.
- **Design system — `components/`:** `theme.ts` (palette / spacing / radius / typography tokens) + `ui/` primitives (`Text`, `Button`, `TextField`, `Screen`, `Card`). Every screen consumes these, so the whole app reskins from the tokens. **Brand + target direction: Talvori** (purple `#6D4CFF`/navy/teal/orange, Plus Jakarta Sans — see `context/ui-tokens.md` Talvori appendix). Current code still renders the older indigo "ibilly" tokens; the rebrand + repalette is the top "Up next" item in `context/progress-tracker.md`.
- **Backend — `supabase/migrations/`:** hand-authored SQL, timestamp-ordered (`YYYYMMDDNNNNNN_*.sql`). RLS + `security definer` RPCs + triggers live here.

## Conventions that will bite you if ignored

- **Money is ALWAYS integer minor units + an ISO currency code — never float.** Minor-unit exponent is currency-specific (JPY=0, USD=2, KWD/BHD/OMR=3) via `lib/money.ts` (`toMinorUnits`, `minorExponent`, `formatMoney`). **Never mix currencies** in one value/transaction; DB triggers re-enforce this (e.g. a price's currency follows its store; a transaction's follows its account). UI enters major units and converts at the screen boundary.
- **RLS is the security boundary, not the client.** Every table is `household_id`-scoped with the same policy shape: `SELECT using (public.is_member_of(household_id))`; writes `using/​with check (public.has_role_in(household_id, array['owner','admin','member']::public.household_role[]))`; deletes often narrowed to `['owner','admin']`. Cross-household mutations that RLS must forbid are asserted in `rls-isolation.mjs` — **extend that script for every new table.**
- **Migrations are applied by hand.** There is no local Postgres and the Supabase CLI is not wired. Workflow: write the migration file → the human pastes it into the Supabase SQL editor ("Success. No rows returned" = applied) → then `test:rls`. Keep `lib/database.types.ts` in sync with each migration by hand.
- **i18n parity is enforced.** All UI copy is `t('...')` keys present in `locales/{en,fil,ar}.json` with **matching key sets** (`tests/lib/i18n.test.ts` fails otherwise). Add keys to all three locales together.
- **RTL / Arabic is first-class.** Use `lib/rtl.ts` (`direction`, `isRTLLanguage`) not raw left/right. Fonts are script-aware: RN selects weight by *family name*, so `lib/fonts.ts` maps each (variant, isArabic) to a concrete family (Space Grotesk / Inter for Latin, Readex Pro for Arabic).
- **Realtime tests are timing-sensitive.** The realtime assertion in `rls-isolation.mjs` warms the socket early (`b.realtime.connect()`) and retries once — don't "fix" flakes by bumping timeouts.
- **No server secrets client-side.** Only `EXPO_PUBLIC_*` values belong in `.env`/the client; service-role and partner secrets go in Supabase Edge Function secrets.
- **Never call `Alert.alert` directly — it is a NO-OP on react-native-web.** Use `useActionSheet` from `components/ui` (native Alert on iOS/Android, token-styled modal on web) and render `sheet.element` in the screen. Every destructive action gets a confirm through it.
- **Every entity has a guarded delete** (trash icon → ActionSheet confirm naming what cascades). New entities must follow: RLS delete policy + api `deleteX` + confirmed UI + `rls-isolation.mjs` assertion.

## Testing approach

Pure helpers and the money/plan/basket/coupon logic have jest unit tests (`tests/**`). Screens are verified by typecheck + the live `test:rls` script + manual run, not by rendering tests (the codebase does not unit-test screens). When adding a feature: put testable logic in a pure module and unit-test it; put I/O in `api.ts`; keep the two separate (e.g. `features/retail/ingest.ts` is pure, `ingestRunner.ts` does I/O — importing the Supabase client into a jest-tested module breaks under jest).

## Work deferred / blocked (do not build speculatively)

Two areas need external accounts/credentials and are intentionally **not** implemented — each has a ready design spec in `context/build-plan.md` Appendix A (`#spec-2026-08-12-phase6b-billing-architecture`, `#spec-2026-08-12-phase5d-connector-architecture`):
- **6b billing** (Apple IAP / Google Play / Stripe-web + webhooks) — needs store/processor accounts. 6a ships the `household_subscriptions` model + a manual owner plan toggle; billing writes the same row via its `source` field.
- **5d live retail** (real connectors, the Edge Function around `ingestFromConnector`, loyalty OAuth, global catalog) — needs an authorized data source. The connector *interface* + a mock connector + the ingest pipeline already exist.

The 6a manual plan toggle in `app/subscription.tsx` is now **dev-gated** (`__DEV__`) so it can't be a free-premium hole in production; 6b replaces it with real purchase flows.

## Workflow (how changes are made here)

This project uses the superpowers/GSD flow: **brainstorm → spec → plan → execute** per slice, with atomic commits (historical specs/plans are folded into `context/build-plan.md` Appendices A/B). Commit messages use conventional prefixes (`feat(scope):`, `test(scope):`, `docs(scope):`). Cross-session context lives in the claude-mem memory (`MEMORY.md` index).

**Doc hygiene — keep the docs compact:** ALL project documentation lives in `context/` (the 9-file context-driven-dev structure) — see `README.md` § "Project documentation". Do **not** create new root or loose `.md` files for project info; extend an existing `context/` file instead. If the `impeccable` skill regenerates `PRODUCT.md` or `DESIGN.md` at the repo root, re-fold them into `context/project-overview.md` (product intent) / the `context/ui-tokens.md` proposed-redesign appendix, then delete the root copies. GSD's `.planning/` tree, if you use GSD workflows, is a separate tool-owned space and does not belong in `context/`.
