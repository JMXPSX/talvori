# Phase 8 — Security / QA / Hardening — Audit (in progress)

Date: 2026-08-12
Status: Secret + client-surface + RLS audit PASSED. Remaining QA items scoped below.

## Secret & client-surface audit — PASS

- **No service-role or non-public secret in client code** (`app/`, `features/`,
  `lib/`, `components/`). The only `service_role` reference is `lib/logger.ts`'s
  redaction denylist (scrubs `token`/`secret`/`service_role`/`cvv`/… from logs) —
  defensive, not a leak.
- **No non-public `process.env` reads** in client code — env flows only through
  `lib/env` (`EXPO_PUBLIC_*`).
- **Service-role key confined to `tests/integration/rls-isolation.mjs`** (added to
  `.env` temporarily for the RLS test, then removed).
- **`.env` is git-ignored and not tracked.** No hardcoded JWTs / `sk_live` /
  `sk_test` / api keys / bearer tokens anywhere in client code.

## RLS / data-layer audit — PASS (already verified live)

- Every household-scoped table has RLS enabled with the uniform pattern
  (`is_member_of` select; `has_role_in` writes). Verified end-to-end by
  `npm run test:rls` — **62/62** including cross-household denial + post-join access.
- `security definer` RPCs all set `search_path = ''` and re-check role
  (`create_transfer`, `complete_grocery_list`, `set_active_saved_location`,
  `set_household_plan`). Triggers enforce household + currency invariants.
- Monetization: subscription writes are owner-only; the 6a manual plan toggle is
  `__DEV__`-gated (no free-premium hole in production).

## Remaining Phase 8 QA items (scoped for a focused session)

These are the roadmap's remaining hardening items (08_DEVELOPMENT_PHASES.md); each
is buildable without external accounts except where noted:

1. **Auth / session tests** — sign-in/out, session persistence/expiry, the auth
   gate redirect; extend the integration harness.
2. **Money / FX tests** — property-style rounding tests across exponents; FX
   consolidation edge cases (already partly covered by unit + globalization tests).
3. **Account deletion / data export** — GDPR-style: an RPC/Edge Function to export
   a household's data and to delete an account + cascade. (New feature work.)
4. **Network-failure UX** — offline/timeout handling and retry affordances on the
   data screens (currently errors surface as a localized message; add retry).
5. **Performance** — list virtualization (FlatList) on the long feeds
   (transactions, products, prices) instead of `.map` in ScrollView.
6. **Crash monitoring** — wire an error reporter (e.g. Sentry) — needs an account.
7. **Backup/recovery review** — Supabase PITR / backup policy (ops, not code).

Recommendation: tackle 1–2 and 4–5 next (pure hardening, no accounts); 3 is a
real feature slice; 6 needs an account.
