# Phase 5 Slice 5d (architecture subset) — Connector Pipeline — Design & ADR

Date: 2026-08-12
Status: Approved (brainstorming complete)
Author: Claude + Joseph

## Context

Slice 5d of Phase 5 is **live retailer connectors + loyalty OAuth + a global
catalog**. Those require external prerequisites that don't exist yet — an
authorized retailer API / licensed feed / partnership, and registered OAuth apps.
The retail spec (06) is explicit: **never scrape, never fake clipping, never put
retailer secrets in client code**, and live calls must flow
`Mobile/Web → our Price API/Edge Function → normalized cache → connectors →
authorized sources`.

So this slice builds only the **architecture subset that needs no credentials**:
the normalization→persist pipeline, a reference (mock) connector proving the
interface, and this ADR documenting how real adapters will plug in. No migration,
no live network calls, no UI, no faked clipping.

## Locked scope

Build:
1. Pure `buildPriceInserts(...)` — map connector `NormalizedPrice[]` → `price_snapshots` insert rows.
2. `mockConnector` — a `RetailerConnector` backed by a static fixture (dev/test only).
3. `ingestFromConnector(...)` — reference runner composing connector → normalize → persist.
4. Unit tests for the pure mapping and the mock connector.
5. This ADR.

Explicitly deferred (needs an authorized source / credentials):
- Any real retailer adapter (Walmart/Kroger/etc.).
- The deployed Supabase Edge Function that runs real connectors server-side.
- Loyalty account linking via OAuth.
- The populated global (cross-household) catalog.

## Reuses (no new schema)

- `price_snapshots` table (5a) — ingest target.
- `features/retail/connector.ts` (5a) — the types-only interface: `RetailerConnector`,
  `NormalizedProduct`, `NormalizedPrice`, `ProductSearchInput`, `PriceLookupInput`.
- `features/retail/api.ts` `createPrice(hid, CreatePriceMinorInput)` — persistence.

## Components

### 1. Pure normalization — `features/retail/ingest.ts`

```
interface PriceInsertRow {
  retailerProductId: string;
  storeId?: string;
  regularMinor: number;
  saleMinor?: number;
  memberMinor?: number;
  currencyCode: string;   // uppercased, validated ^[A-Z]{3}$
  source: string;
}

buildPriceInserts(
  retailerProductId: string,
  storeId: string | undefined,
  prices: NormalizedPrice[],
): PriceInsertRow[]
```

Rules: skip any `NormalizedPrice` with an invalid currency (`!/^[A-Z]{3}$/`) or a
non-finite/negative `regularMinor`; uppercase the currency; carry through
`saleMinor`/`memberMinor` only when present and `>= 0`; default `source` to the
connector value or `'connector'`. Pure — no I/O, fully unit-testable. Shape aligns
with `CreatePriceMinorInput` so the runner can persist directly.

### 2. Reference connector — `features/retail/connectors/mockConnector.ts`

A `RetailerConnector` whose `searchProducts` / `fetchPrice` return values from a
static in-memory fixture. Header comment states plainly: **dev/test fixture only,
not a live retailer, performs no network calls and no coupon clipping.** Exists to
prove the interface is implementable and to exercise the pipeline in tests.

### 3. Reference ingest runner — `features/retail/ingest.ts`

```
ingestFromConnector(
  householdId: string,
  connector: RetailerConnector,
  retailerProductId: string,
  storeId?: string,
): Promise<number>   // count of snapshots inserted
```

Composes `connector.fetchPrice({ retailerProductId, storeId })` →
`buildPriceInserts(...)` → `createPrice(householdId, row)` per row; returns the
count. This is the exact logic a production **Edge Function** would run
server-side. Locally it works against `mockConnector`. Not wired to any screen.

## ADR — how real connectors plug in later

- **Where they run:** real adapters run inside a Supabase **Edge Function**, never
  on device. The client calls the Edge Function ("our Price API"); the function
  holds retailer credentials (from Edge secrets), calls the authorized source,
  normalizes, and upserts `price_snapshots`. `ingestFromConnector` is that
  function's core, already written and tested here.
- **Interface stability:** new adapters implement `RetailerConnector`; no schema or
  pipeline change needed — only a new file + registration in the Edge Function.
- **Loyalty:** OAuth/account-linking per retailer, tokens stored server-side
  (encrypted), never in the client. A future `loyalty_connections` table + an Edge
  Function OAuth callback. Out of scope until a retailer program is available.
- **Global catalog:** an authorized feed populates a read-only global catalog
  (separate from household-scoped rows); households reference global products.
  Requires a governed data source; out of scope now.
- **Data-source rule:** only official APIs / licensed feeds / partner / permitted
  affiliate / authorized datasets / merchant-provided data. No unauthorized
  scraping. No guaranteed real-time checkout-price claims unless the source
  contract supports it.

## Tests — `tests/retail/ingest.test.ts`

- `buildPriceInserts`: maps a valid `NormalizedPrice` (regular+sale) to one row;
  uppercases currency; skips an invalid-currency entry; skips a negative regular;
  omits `saleMinor`/`memberMinor` when absent; empty input → `[]`.
- `mockConnector`: `fetchPrice` returns the fixture's prices for a known id and
  `[]` for an unknown id; `buildPriceInserts` over `mockConnector.fetchPrice(...)`
  yields the expected rows (pipeline composition, no DB).

## Success criteria
- `buildPriceInserts` and `mockConnector` are unit-tested and pass.
- `ingestFromConnector` typechecks and composes the tested pieces.
- The ADR documents the real-connector / loyalty / global-catalog boundary.
- `typecheck` clean; all unit tests pass. (No migration, no `test:rls` change.)

## Out of scope
Everything requiring credentials or an authorized data source (see "deferred"),
plus any UI. When a source exists, execute the ADR: add a real adapter + deploy
the Edge Function around `ingestFromConnector`.
