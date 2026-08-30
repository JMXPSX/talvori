# Library Docs

> Project-specific usage patterns and rules for our own `lib/*` modules and key external
> dependencies. **These override general training knowledge.**

## Authority order

When you need to know how something works, consult in this order:

1. **MCP server / real-time docs** (e.g. Supabase docs tool) — most current.
2. **Skills** surfaced via the harness / AGENTS.md.
3. **This file** — project rules and conventions.
4. **General training knowledge** — least reliable for versioned APIs.

---

## Internal libs (`lib/`)

### `lib/money.ts` — the money engine
Integer minor units + ISO currency code, always. Key functions: `toMinorUnits`,
`minorExponent`, `formatMoney`. Exponent is currency-specific (JPY=0, USD=2, KWD/BHD/OMR=3).
**Rules:** never float; never mix currencies in one value; UI enters major units and converts
at the screen boundary. Money math and formatting have jest unit tests — add cases for any
new currency edge (esp. zero- and three-decimal).

### `lib/format.ts` — locale/timezone display
Locale-aware display via `Intl`. Never hard-code `$`, `USD`, two decimals, or US date/number
formats. Formatting respects the user's locale/currency/timezone model.

### `lib/fonts.ts` — script-aware typography
RN selects weight by *family name*, not a numeric weight. `lib/fonts.ts` maps each
(variant, isArabic) pair to a concrete family: Space Grotesk / Inter (Latin), Readex Pro
(Arabic). Fonts are loaded as a gate in `app/_layout.tsx`. Always resolve through this module.

### `lib/rtl.ts` — direction
`direction`, `isRTLLanguage`. Use these instead of raw left/right anywhere layout depends on
direction. Arabic is first-class RTL.

### `lib/i18n.ts` — translations
`t('domain.key')`. Keys must exist in all three of `locales/{en,fil,ar}.json` with matching
key sets (`tests/lib/i18n.test.ts` enforces parity). Add keys to all three at once.

### `lib/supabase.ts` — client
`getSupabase()` returns the client (null until `.env` is configured). **Only `features/*/api.ts`
may call it** — never screens. The client is intentionally schema-agnostic; cast results to
`lib/database.types.ts` at the api boundary.

### `lib/errors.ts` — errors
`AppError` + `toAppError`. Normalize thrown/caught errors through these for consistent
user-facing messaging and retry UX.

### `lib/validation.ts` — input validation
`validate(schema, input)` wraps zod. Feature input schemas live in `features/<domain>/schemas.ts`.

### `lib/database.types.ts` — hand-maintained DB types
The typed shape of the DB, kept in sync with `supabase/migrations/` **by hand**. Update it in
the same change as any migration.

---

## External dependencies

### Expo Router
File-based routing under `app/`. `app/_layout.tsx` is the root: font gate → provider nesting
(`AuthProvider → ActiveHouseholdProvider → EntitlementsProvider → RootNavigator`) → auth gate.
Tabs in `app/(tabs)/`; feature stacks in `app/<domain>/`. Create-flows are modal routes.

### Supabase (supabase-js + Realtime/Broadcast + Edge Functions)
- Access only through `features/*/api.ts`.
- RLS is the security boundary; every household query is implicitly household-scoped by policy.
- Realtime is timing-sensitive in tests — the RLS drill warms the socket early
  (`b.realtime.connect()`) and retries once; don't "fix" flakes by bumping timeouts.
- Sensitive third-party calls belong in Edge Functions with server-side secrets, never client.

### zod
Schema-first validation via `lib/validation.ts`. Define per-feature schemas; validate at the
api boundary before writes.

### react-native / react-native-web
- **`Alert.alert` is a no-op on web** — never call it. Use `useActionSheet` from
  `components/ui`.
- Web-only style keys (e.g. `outline*`) must be platform-gated (see `webFocusRing` in
  `components/theme.ts`); native warns on unknown style keys.

---

## Adding a new library

Prefer the approved stack. Don't add dependencies arbitrarily (see `code-standards.md`). If a
new dependency is genuinely needed, note it here with its project-specific usage rules and any
constraints that override its defaults.
