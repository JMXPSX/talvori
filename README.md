# Talvori

**Talvori** — *"One plan. Everyone. Together."* The public brand for this global household
finance app (chosen in the design workspace; see `context/project-overview.md`). The app now
renders the **Talvori** design system — purple `#6D4CFF`/navy/teal/orange on Plus Jakarta Sans,
built section-by-section from `context/claude_code_handoff/TALVORI_MOBILE_UI_SPEC.md` (the earlier
indigo look is retired).

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
> monitoring. Roadmap: `context/build-plan.md`; beta steps:
> `context/build-plan.md#spec-2026-08-13-phase9-beta-runbook`.

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
context/        all project docs (see "Project documentation" below) — overview,
                architecture, standards, library, UI, build plan, progress tracker
```

Path alias: `@/*` maps to the repo root (e.g. `import { money } from '@/lib/money'`).

## Project documentation

All project context lives in [`context/`](context/), adopting JS Mastery's
[context-driven-dev](https://github.com/jsmastery-pro/context-driven-dev) structure — the premise
being that agents fail not because they can't code, but because they don't know the project.
**Read these at the start of each session** (all but the tracker are stable reference; the tracker
updates every session):

| File | Role |
|------|------|
| [context/project-overview.md](context/project-overview.md) | Vision, problem, positioning, users, scope, globalization, brand, a11y, status |
| [context/architecture.md](context/architecture.md) | Stack, folders, boundaries, data flows, DB, auth, RLS, retail, invariants, decision log |
| [context/build-plan.md](context/build-plan.md) | Phased roadmap + per-slice specs (Appendix A) & plans (Appendix B) |
| [context/code-standards.md](context/code-standards.md) | Engineering rules, git/commit, review gates, testing |
| [context/library-docs.md](context/library-docs.md) | `lib/*` + external dependency usage rules (override training knowledge) |
| [context/ui-tokens.md](context/ui-tokens.md) | Design tokens (RN-adapted from `components/theme.ts`) + proposed-redesign appendix |
| [context/ui-rules.md](context/ui-rules.md) | UI behavior: layout, nav, cards, buttons, forms, states |
| [context/ui-registry.md](context/ui-registry.md) | Catalog of `components/ui/` primitives |
| [context/progress-tracker.md](context/progress-tracker.md) | **Live** status — done / in-progress / next / blocked / decisions |

Deep reference in the same folder: [`context/supabase.md`](context/supabase.md) (migrations/RLS
guide) and [`context/ORCHESTRATION.md`](context/ORCHESTRATION.md) (standalone runbook for the
two-agent Terminal-writes / Desktop-reviews workflow). Talvori brand image assets live in
`assets/brand/`; the raw design workspace is archived in git history. The former numbered `00_`–`11_` root specs, ADRs, and
separate `specs/`/`plans/` folders were consolidated into the files above — all recoverable from
git history. `CLAUDE.md` is Claude Code's operational entry point and refers into these.

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
work (`context/code-standards.md`). High-risk areas (auth, RLS,
money, FX, payments, secrets) require developer review and tests before merge.
```
feat(auth): add email OTP verification flow
test(money): cover zero-decimal currencies
```
