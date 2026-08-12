# Global Household App

Internal codename: **Global Household App** (no public branding yet — see
`00_README_START_HERE.md`).

A global household finance, budgeting, shared-shopping, retail-pricing and
multi-currency platform. One universal codebase (Expo) targets **iOS, Android,
and Web/PWA**.

> **Status: Phase 1 — Technical Foundation.** This repo currently contains the
> app skeleton only: universal navigation, localization + RTL, a safe Supabase
> client, the money primitive, error/logging/validation seams, and a testing
> foundation. **No authentication, database schema, finance, shopping, or retail
> functionality yet** — those arrive in later phases (`08_DEVELOPMENT_PHASES.md`).

## Prerequisites

- **Node.js 20+** (developed on v24)
- **npm** (comes with Node)
- **Expo Go** app on a physical device, or an iOS Simulator (macOS) / Android
  emulator, to run natively. Web needs only a browser.

## Installation

```bash
npm install
```

## Environment setup

```bash
cp .env.example .env      # Windows: copy .env.example .env
```

Then edit `.env`. For Phase 1 the app runs **without** real values (backend
calls are simply disabled). To connect a Supabase project, set:

- `EXPO_PUBLIC_APP_ENV` — `development` | `staging` | `production`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` (publishable/anon key only)

Only client-safe (`EXPO_PUBLIC_*`) values ever belong here. **Never** put
service-role or any partner secret in this file or in the client — those live in
Supabase Edge Function secrets (see `02`/`03`).

## Running

```bash
npm run web        # open in a browser (fastest way to verify)
npm run android    # Android emulator / device via Expo Go
npm run ios        # iOS simulator (macOS only) / device via Expo Go
npm start          # Expo dev server; press w / a / i to choose a target
```

## Testing & type checking

```bash
npm test           # jest-expo unit + component tests
npm run test:watch # watch mode
npm run typecheck  # tsc --noEmit (strict)
```

## Project structure

```
app/            Expo Router routes (file-based navigation)
  (tabs)/       Home, Budget, Transactions, Grocery, More
  login.tsx     auth placeholders (no real auth yet — Phase 2)
  signup.tsx
components/     design-system skeleton (theme tokens + ui/ primitives)
features/       per-domain logic (auth, finance, … — added per phase)
lib/            env, supabase client, i18n, rtl, money, errors, logger, validation
locales/        en / fil / ar placeholder catalogs
services/       cross-cutting service interfaces (retail connector, …)
supabase/       migrations/ + functions/ (backend, Phase 2+)
tests/          jest setup + unit/component tests
docs/adr/       Architecture Decision Records
```

Path alias: `@/*` maps to the repo root (e.g. `import { money } from '@/lib/money'`).

## Non-negotiable rules (enforced across the codebase)

- Money is **integer minor units + currency code** — never floating point, never
  hard-coded `$`/`USD`/2 decimals (`lib/money.ts`).
- All UI copy goes through `t('...')` keys — no hard-coded strings.
- Arabic/RTL is a first-class concern — use `lib/rtl.ts` helpers, not raw
  left/right.
- No server secrets in client code or `EXPO_PUBLIC_*`.

## Contributing

Small, reviewable changes on short-lived feature branches; PRs for meaningful
work (`10_DEVELOPER_REVIEW_AND_GIT_WORKFLOW.md`). High-risk areas (auth, RLS,
money, FX, payments, secrets) require developer review and tests before merge.
```
feat(auth): add email OTP verification flow
test(money): cover zero-decimal currencies
```
