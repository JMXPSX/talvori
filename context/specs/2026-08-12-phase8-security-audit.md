# Phase 8 — Security / QA / Hardening — Audit

Date: 2026-08-12 (closed 2026-08-13)
Status: **COMPLETE** for everything buildable without external accounts.
Deferred with reasons: payment tests (blocked on 6b billing accounts), crash
monitoring (needs a Sentry-class account), backup/PITR review (Supabase
dashboard ops, human), list virtualization (feeds are query-capped at 50 —
revisit with pagination). Session assertions were added to `rls-isolation.mjs`
and run on the next service-key drill.

Next phase: **Phase 9 — Beta** (founder + spouse + trusted users, then
TestFlight / Play testing track / web beta). Entry needs human decisions:
web hosting target for the PWA, Apple/Google developer accounts, and a real
Site URL + redirect allow-list in Supabase auth settings.

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

These are the roadmap's remaining hardening items (`context/build-plan.md`); each
is buildable without external accounts except where noted:

1. **Auth / session tests** — ✅ pure slice DONE (2026-08-13): `mapAuthError`
   extracted to `features/auth/errors.ts` + mapping/locale-resolution tests
   (`tests/auth/errors.test.ts`). REMAINING: live sign-in/out + session
   persistence assertions in the integration harness (needs the temporary
   service-role key drill, human-run like `test:rls`).
2. **Money / FX tests** — ✅ DONE (2026-08-13): fixed `toMinorUnits` negative-half
   rounding (was toward +∞, now half-away-from-zero per its contract), added
   deterministic property round-trips across exponents 0/2/3, float-trap cases,
   and `sumInReporting` edges (deduped missing, empty, case, negatives, KWD).
3. **Account deletion / data export** — ✅ DONE & VERIFIED LIVE (2026-08-13; see
   `2026-08-13-account-deletion-export-design.md` + plan): `delete_my_account()`
   RPC with owner-handoff block, attribution FKs → set-null, full-household JSON
   export (client-side over RLS readers), `/account` screen behind More.
   Migrations `20260813000010_account_deletion.sql` AND
   `20260813000011_fix_last_owner_guard.sql` applied; `test:rls` **72/72**.
   The drill surfaced a Phase-2 latent bug: `protect_last_owner()` fired on the
   member-row FK cascade and made ALL household deletion impossible — fixed by
   early-returning when the household row is already gone. Bonus: 19 orphaned
   test users from every prior `test:rls` run (cleanup had been silently
   blocked by that same bug) were purged via the new RPC.
4. **Network-failure UX** — ✅ DONE (2026-08-13): `ErrorNotice` primitive
   (message + Retry) wired into home / transactions / grocery / budgets error
   states; `common.retry` in en/fil/ar. Remaining screens (retail/household/
   goals/debts) can adopt it opportunistically when next touched.
5. **Performance** — list virtualization DEPRIORITIZED for now: every feed is
   query-capped (`listTransactions` limit 50; other lists similarly bounded), so
   ScrollView+map is fine at current scale. Revisit if caps are raised or
   pagination lands.
6. **Crash monitoring** — wire an error reporter (e.g. Sentry) — needs an account.
7. **Backup/recovery review** — Supabase PITR / backup policy (ops, not code).

Also DONE (2026-08-13, adjacent hardening): `useActionSheet`/`ActionSheetDialog`
— Alert.alert is a no-op on react-native-web, so the transactions "+" chooser
and delete confirm now fall back to a token-styled modal on web (native keeps
the platform Alert).
