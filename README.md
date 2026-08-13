# Global Household App

Internal codename: **Global Household App** (no public branding yet — see
`00_README_START_HERE.md`).

A global household finance, budgeting, shared-shopping, retail-pricing and
multi-currency platform. One universal codebase (Expo) targets **iOS, Android,
and Web/PWA**, on a Supabase backend where **Postgres RLS is the security
boundary**.

> **Status: Phases 1–8 complete; entering Phase 9 (Beta).** Built and verified
> against the live backend: email auth with password reset, households with
> roles/invitations/realtime, the full financial core (accounts, transactions,
> transfers, categories, budgets, goals, debts, multi-currency FX rollups),
> shared grocery lists, retail price intelligence (catalog, price snapshots,
> unit prices, coupons, comparison), free/premium entitlements, i18n
> (en/fil/ar) with first-class RTL, the "Ledger & Remittance" design system,
> GDPR-style data export and account deletion, and a hardening pass (security
> audit, live RLS drill, money property tests). Deferred until external
> accounts exist: store billing (6b), live retailer connectors (5d), crash
> monitoring. Roadmap: `08_DEVELOPMENT_PHASES.md`; beta steps:
> `docs/superpowers/specs/2026-08-13-phase9-beta-runbook.md`.

## Prerequisites

- **Node.js 20+** (developed on v24)
- **npm** (comes with Node)
- **Expo Go** app on a physical device, or an iOS Simulator (macOS) / Android
  emulator, to run natively. Web needs only a browser.
- A **Supabase project** with the migrations applied (below).

## Installation

```bash
npm install
```

## Environment setup

```bash
cp .env.example .env      # Windows: copy .env.example .env
```

Then edit `.env`:

- `EXPO_PUBLIC_APP_ENV` — `development` | `staging` | `production`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` (publishable/anon key only)

Only client-safe (`EXPO_PUBLIC_*`) values ever belong here. **Never** put
service-role or any partner secret in this file or in the client — those live in
Supabase Edge Function secrets (see `02`/`03`). The service-role key is used
only transiently for `npm run test:rls` (added to `.env`, run, removed).

## Backend setup

Migrations in `supabase/migrations/` are hand-applied, in timestamp order, via
the Supabase SQL editor (each should end with "Success. No rows returned").
They create the full schema, RLS policies, `security definer` RPCs, and
triggers. Keep `lib/database.types.ts` in sync when changing them.

## Running

```bash
npm run web        # open in a browser (fastest way to verify)
npm run android    # Android emulator / device via Expo Go
npm run ios        # iOS simulator (macOS only) / device via Expo Go
npm start          # Expo dev server; press w / a / i to choose a target
```

## Testing & type checking

```bash
npm test           # jest-expo unit + component tests (money, FX, i18n parity, …)
npm run test:watch # watch mode
npm run typecheck  # tsc --noEmit (strict)
npm run lint       # expo lint (eslint 9, expo flat config)
npm run test:rls   # LIVE household-isolation + deletion drill (see .env note)
```

## Project structure

```
app/            Expo Router routes (file-based navigation)
  (tabs)/       Home dashboard, Budget hub, Transactions, Grocery, More
  finance/      accounts, entry, transfer, categories, budgets, goals, debts, rates
  grocery/      list detail, product linking, price comparison, create modal
  household/    manage households, members, invitations
  retail/       retailers, branches, products, prices, coupons, locations
  account.tsx   data export + guarded account deletion
components/     design system: theme tokens + ui/ primitives
                (Text, Screen, Button, TextField, Card, EmptyState, Donut,
                 ProgressBar, ListRow, ActionSheet, ErrorNotice)
features/       per-domain logic: api.ts (data access) + schemas + pure helpers
lib/            env, supabase client, i18n, rtl, fonts, money, format,
                errors, logger, validation, database.types
locales/        en / fil / ar catalogs (key parity enforced by tests)
supabase/       hand-applied SQL migrations (schema + RLS + RPCs + triggers)
tests/          jest unit/component tests + live RLS integration drill
docs/           ADRs + superpowers specs/plans (per-slice design docs)
```

Path alias: `@/*` maps to the repo root (e.g. `import { money } from '@/lib/money'`).

## Non-negotiable rules (enforced across the codebase)

- Money is **integer minor units + currency code** — never floating point, never
  hard-coded `$`/`USD`/2 decimals (`lib/money.ts`; JPY=0, USD=2, KWD=3).
- **RLS is the security boundary** — screens never call `getSupabase()`
  directly; only `features/*/api.ts` does. Every new table gets policies AND an
  assertion in `tests/integration/rls-isolation.mjs`.
- All UI copy goes through `t('...')` keys, present in **all three** locales.
- Arabic/RTL is a first-class concern — use `lib/rtl.ts` helpers, not raw
  left/right.
- Dialogs/confirms go through `useActionSheet` (native Alert / web modal) —
  never raw `Alert.alert`, which is a no-op on web.
- No server secrets in client code or `EXPO_PUBLIC_*`.

## Contributing

Small, reviewable changes on short-lived feature branches; PRs for meaningful
work (`10_DEVELOPER_REVIEW_AND_GIT_WORKFLOW.md`). High-risk areas (auth, RLS,
money, FX, payments, secrets) require developer review and tests before merge.
```
feat(auth): add email OTP verification flow
test(money): cover zero-decimal currencies
```
