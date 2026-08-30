# ADR 0002 — Phase 1 foundation choices

- **Status:** Accepted
- **Date:** 2026-08-12

## Context

Phase 1 (the former `09_PHASE_1_CLAUDE_BUILD_PROMPT.md`, now in git history; see
`context/build-plan.md`) builds the technical foundation for
a global, multi-currency, multi-platform household finance app: no business
logic yet, but choices here must not block Phase 2+ (auth, RLS, money, FX, RTL).

## Decisions

1. **Modular monolith on Expo (SDK 57) + Expo Router**, one universal codebase
   for iOS / Android / Web. No microservices (per `02`).
2. **Flat, feature-based top-level layout** (`app/ components/ features/ lib/
   services/ locales/ supabase/ tests/`) with a `@/*` path alias to the repo
   root, instead of the SDK's default `src/` nesting — matches the layout named
   in `02`.
3. **Money = integer minor units + ISO currency code** (`lib/money.ts`).
   Currency-aware exponents (JPY=0, USD=2, BHD/KWD=3); formatting via
   `Intl.NumberFormat`. No floats, no hard-coded `$`/`USD`/2-decimals (per `04`).
4. **i18n from day one** (`expo-localization` + `i18next` + `react-i18next`)
   with `en` / `fil` / `ar` placeholder catalogs, plus an **RTL foundation**
   (`lib/rtl.ts`) so Arabic needs no redesign later (per `05`).
5. **Supabase client uses only the publishable anon key**; native persists
   sessions via AsyncStorage. The app boots even when unconfigured
   (`env.isSupabaseConfigured === false`). No server secrets in the client
   (per `02`/`03`).
6. **Zod validation** at boundaries, surfaced through a single `AppError`
   model + safe `logger` that redacts sensitive keys (per `09` J/K/L).
7. **jest-expo + Testing Library** as the test foundation; money and i18n (the
   high-risk primitives) are covered now (per `10` testing gate).

## Alternatives

- Default `src/`-nested Expo template layout (rejected: diverges from the
  layout the spec names; alias makes flat layout ergonomic).
- Floating-point money / `Intl` symbol assumptions (rejected: violates `04`).
- Defer i18n/RTL to a later phase (rejected: `05` requires Arabic-ready layout
  from the start; retrofitting RTL is expensive).

## Consequences

- Adding a language = one JSON catalog + a `SUPPORTED_LANGUAGES` entry.
- Every money value must be constructed via `lib/money.ts`; direct arithmetic
  on major-unit floats is disallowed.
- Backend work (schema, RLS, Edge Functions) is unblocked but intentionally
  empty until Phase 2.
