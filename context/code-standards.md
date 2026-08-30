# Code Standards

> Absorbs: `02_NON_NEGOTIABLE_ARCHITECTURE_RULES.md` (AI coding rule), `10_DEVELOPER_
> REVIEW_AND_GIT_WORKFLOW.md`, and the conventions section of `CLAUDE.md`. The living
> rulebook that keeps engineering consistent across sessions.

## Engineering mindset

- Small, reviewable changes. State the file path, give complete file content for
  created/modified files, explain what changes, list dependencies, don't touch unrelated
  files, include tests for high-risk logic.
- Don't build the whole app in one pass. Don't invent architecture as you go. Don't silently
  change approved requirements. Prefer the most conservative architecture-consistent choice
  and document it rather than blocking.
- MVP simplicity over premature enterprise complexity.

## Language & type safety

- TypeScript strict. `npm run typecheck` (`tsc --noEmit`) must pass after **every** change.
- Query results are cast to `lib/database.types.ts` at the `api.ts` boundary — keep that
  file in sync with each migration by hand.

## File & folder organization

- Feature-based: `features/<domain>/` owns `api.ts` (I/O), `schemas.ts` (zod), pure helpers.
- Put testable logic in a pure module and unit-test it; put I/O in `api.ts`; keep the two
  separate (importing the Supabase client into a jest-tested module breaks under jest).
- No giant unstructured screens folder. Routes live in `app/` (Expo Router).
- Path alias `@/*` → repo root.

## Module structure

- Screens consume `components/ui` primitives + `components/theme` tokens — never raw hex,
  magic spacing, or `Alert.alert`.
- Screens never call `getSupabase()`; they call `features/*/api.ts`.
- UI enters money in major units and converts at the screen boundary via `lib/money.ts`.

## Database & migrations

- RLS policy shape is uniform (see `architecture.md`). Every new household table gets: RLS
  policies, an `api.ts` `deleteX`, a confirmed guarded-delete UI, and an assertion in
  `tests/integration/rls-isolation.mjs`.
- Migrations are hand-authored (`supabase/migrations/YYYYMMDDNNNNNN_*.sql`) and applied by
  hand via the Supabase SQL editor. No local Postgres; the CLI is not wired.
- Favor traceable updates over destructive silent mutation for financial records
  (created_by/updated_by, append-style history where valuable).

## Error handling

- Use `lib/errors.ts` (`AppError`, `toAppError`) and `lib/validation.ts` (`validate`).
- **Never call `Alert.alert`** — it is a no-op on react-native-web. Use `useActionSheet`
  from `components/ui` and render `sheet.element`. Every destructive action confirms through it.

## i18n & RTL

- All UI copy is `t('...')` keys present in `locales/{en,fil,ar}.json` with **matching key
  sets** (`tests/lib/i18n.test.ts` fails otherwise). Add keys to all three locales together.
- RTL/Arabic is first-class: use `lib/rtl.ts` (`direction`, `isRTLLanguage`), never raw
  left/right. Fonts are script-aware via `lib/fonts.ts`.

## Secrets & env

- Only `EXPO_PUBLIC_*` belongs in `.env`/client. Never commit secrets. Service-role and
  partner secrets go in Supabase Edge Function secrets.
- `SUPABASE_SERVICE_ROLE_KEY` is added to `.env` only *temporarily* to run `npm run test:rls`,
  then removed. It must never ship or live in `EXPO_PUBLIC_*`.

## Git & commits

- `main` is protected/releasable; work on short-lived feature branches; PR meaningful changes.
- Conventional commits: `feat(scope):`, `fix(scope):`, `test(scope):`, `docs(scope):`.
  Examples: `feat(auth): add email OTP verification flow`, `test(money): cover zero-decimal
  currencies`, `fix(money): formatting JPY`.
- Atomic commits per slice.

## Mandatory review areas

Developer review required for: authentication/security, RLS, DB migrations, money
calculations, FX handling, payment/subscription integration, retailer API/license behavior,
secrets, data deletion/export. **Do not merge high-risk changes without relevant tests.**

## Testing gate

- `npm run typecheck` + `npm test` (jest-expo) green before commit.
- Pure helpers/money/plan/basket/coupon logic have jest unit tests. Screens are verified by
  typecheck + the live `test:rls` drill + manual run (the codebase does not unit-test screens).

## Comments & dependencies

- Self-documenting code; comment the *why*, not the *what*. Match surrounding comment density.
- Don't add dependencies arbitrarily. Stick to the approved stack (see `architecture.md`).

## ADRs

Record major choices under `context/adr/` (context, decision, alternatives, consequences).
Examples worth an ADR: why modular monolith, why integer minor units, why Supabase Broadcast,
why retailer connectors, why PWA before native desktop.
