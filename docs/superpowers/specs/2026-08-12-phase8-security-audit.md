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

1. **Auth / session tests** — ✅ pure slice DONE (2026-08-13): `mapAuthError`
   extracted to `features/auth/errors.ts` + mapping/locale-resolution tests
   (`tests/auth/errors.test.ts`). REMAINING: live sign-in/out + session
   persistence assertions in the integration harness (needs the temporary
   service-role key drill, human-run like `test:rls`).
2. **Money / FX tests** — ✅ DONE (2026-08-13): fixed `toMinorUnits` negative-half
   rounding (was toward +∞, now half-away-from-zero per its contract), added
   deterministic property round-trips across exponents 0/2/3, float-trap cases,
   and `sumInReporting` edges (deduped missing, empty, case, negatives, KWD).
3. **Account deletion / data export** — ✅ BUILT (2026-08-13; see
   `2026-08-13-account-deletion-export-design.md` + plan): `delete_my_account()`
   RPC with owner-handoff block, attribution FKs → set-null, full-household JSON
   export (client-side over RLS readers), `/account` screen behind More.
   ⏳ PENDING HUMAN: apply migration `20260813000010_account_deletion.sql` in
   the SQL editor, then run the `test:rls` key drill (now includes the deletion
   scenarios).
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
