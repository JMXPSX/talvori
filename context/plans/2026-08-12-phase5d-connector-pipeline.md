# Phase 5 Slice 5d (architecture subset) — Connector Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the credential-free 5d architecture — a pure normalize→persist price pipeline, a reference (mock) connector, and a reference ingest runner — proving the connector interface works end-to-end without any live integration.

**Architecture:** No migration, no live network calls, no UI. Reuses the 5a `price_snapshots` table, the types-only `connector.ts` interface, and `createPrice`. A pure `buildPriceInserts` maps `NormalizedPrice[]` → insert rows; `mockConnector` implements `RetailerConnector` from a fixture; `ingestFromConnector` composes them and persists — the exact core a production Edge Function will run server-side.

**Tech Stack:** TypeScript, jest. (No Supabase schema change.)

## Global Constraints

- **Money is ALWAYS integer minor units + ISO currency code.** `buildPriceInserts` validates `^[A-Z]{3}$` and rejects non-finite/negative amounts.
- **No faking, no scraping, no client-side secrets.** `mockConnector` is a labeled dev/test fixture that performs no network calls and no coupon clipping. Real adapters run server-side (Edge Function) — see the ADR.
- **No new migration; no `test:rls` change.**
- Verification: `npm run typecheck`, `npm test`.

---

### Task 1: Pure `buildPriceInserts` (TDD)

**Files:**
- Create: `features/retail/ingest.ts` (the `buildPriceInserts` export + `PriceInsertRow` type)
- Test: `tests/retail/ingest.test.ts`

**Interfaces:**
- Consumes: `NormalizedPrice` from `features/retail/connector.ts`.
- Produces:
  - `interface PriceInsertRow { retailerProductId: string; storeId?: string; regularMinor: number; saleMinor?: number; memberMinor?: number; currencyCode: string; source: string }`
  - `buildPriceInserts(retailerProductId: string, storeId: string | undefined, prices: NormalizedPrice[]): PriceInsertRow[]`

- [ ] **Step 1: Write the failing tests**

Create `tests/retail/ingest.test.ts`:

```typescript
import { buildPriceInserts } from '@/features/retail/ingest';
import type { NormalizedPrice } from '@/features/retail/connector';

function np(over: Partial<NormalizedPrice>): NormalizedPrice {
  return {
    regularMinor: 1000,
    currencyCode: 'usd',
    observedAt: '2026-08-12T00:00:00Z',
    source: 'connector',
    ...over,
  };
}

describe('buildPriceInserts', () => {
  it('maps a valid price and uppercases the currency', () => {
    const rows = buildPriceInserts('rp1', 's1', [np({ regularMinor: 1000, saleMinor: 800, currencyCode: 'usd' })]);
    expect(rows).toEqual([
      { retailerProductId: 'rp1', storeId: 's1', regularMinor: 1000, saleMinor: 800, currencyCode: 'USD', source: 'connector' },
    ]);
  });

  it('omits sale/member when absent and passes storeId undefined', () => {
    const rows = buildPriceInserts('rp1', undefined, [np({ regularMinor: 500 })]);
    expect(rows).toEqual([
      { retailerProductId: 'rp1', storeId: undefined, regularMinor: 500, currencyCode: 'USD', source: 'connector' },
    ]);
  });

  it('skips an invalid currency', () => {
    expect(buildPriceInserts('rp1', undefined, [np({ currencyCode: 'US' })])).toEqual([]);
  });

  it('skips a negative or non-finite regular price', () => {
    expect(buildPriceInserts('rp1', undefined, [np({ regularMinor: -1 })])).toEqual([]);
    expect(buildPriceInserts('rp1', undefined, [np({ regularMinor: Number.NaN })])).toEqual([]);
  });

  it('defaults source to "connector" when the price omits it', () => {
    const rows = buildPriceInserts('rp1', undefined, [{ regularMinor: 100, currencyCode: 'PHP', observedAt: 'x', source: '' }]);
    expect(rows[0]?.source).toBe('connector');
  });

  it('returns [] for empty input', () => {
    expect(buildPriceInserts('rp1', 's1', [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest tests/retail/ingest.test.ts`
Expected: FAIL — cannot find module `@/features/retail/ingest`.

- [ ] **Step 3: Write the implementation**

Create `features/retail/ingest.ts`:

```typescript
/**
 * Connector ingest pipeline (5d architecture subset). `buildPriceInserts` is a
 * pure mapping from a connector's NormalizedPrice[] to price_snapshots insert
 * rows; `ingestFromConnector` (added later) composes a connector + this mapping +
 * persistence. In production the runner lives in a Supabase Edge Function so
 * retailer secrets never reach the client (see the 5d ADR).
 */

import type { NormalizedPrice } from '@/features/retail/connector';

export interface PriceInsertRow {
  retailerProductId: string;
  storeId?: string;
  regularMinor: number;
  saleMinor?: number;
  memberMinor?: number;
  currencyCode: string;
  source: string;
}

const isValidMinor = (n: number | undefined): n is number =>
  n !== undefined && Number.isFinite(n) && n >= 0;

/** Map connector prices to insert rows, dropping malformed entries. Pure. */
export function buildPriceInserts(
  retailerProductId: string,
  storeId: string | undefined,
  prices: NormalizedPrice[],
): PriceInsertRow[] {
  const rows: PriceInsertRow[] = [];
  for (const p of prices) {
    const currencyCode = (p.currencyCode ?? '').toUpperCase();
    if (!/^[A-Z]{3}$/.test(currencyCode)) continue;
    if (!Number.isFinite(p.regularMinor) || p.regularMinor < 0) continue;
    const row: PriceInsertRow = {
      retailerProductId,
      storeId,
      regularMinor: p.regularMinor,
      currencyCode,
      source: p.source && p.source.length > 0 ? p.source : 'connector',
    };
    if (isValidMinor(p.saleMinor)) row.saleMinor = p.saleMinor;
    if (isValidMinor(p.memberMinor)) row.memberMinor = p.memberMinor;
    rows.push(row);
  }
  return rows;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest tests/retail/ingest.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add features/retail/ingest.ts tests/retail/ingest.test.ts
git commit -m "feat(5d): pure buildPriceInserts normalization + tests"
```

---

### Task 2: Reference mock connector

**Files:**
- Create: `features/retail/connectors/mockConnector.ts`

**Interfaces:**
- Consumes: `RetailerConnector`, `NormalizedProduct`, `NormalizedPrice`, `ProductSearchInput`, `PriceLookupInput` from `features/retail/connector.ts`.
- Produces: `mockConnector: RetailerConnector` and `MOCK_FIXTURE` (for tests).

- [ ] **Step 1: Write the mock connector**

Create `features/retail/connectors/mockConnector.ts`:

```typescript
/**
 * DEV/TEST FIXTURE ONLY — not a live retailer. Performs NO network calls and NO
 * coupon clipping. Exists to prove the RetailerConnector interface is
 * implementable and to exercise the ingest pipeline in tests. Real adapters
 * (Walmart/Kroger/etc.) run server-side in an Edge Function — see the 5d ADR.
 */

import type {
  NormalizedPrice,
  NormalizedProduct,
  PriceLookupInput,
  ProductSearchInput,
  RetailerConnector,
} from '@/features/retail/connector';

export const MOCK_FIXTURE: {
  products: NormalizedProduct[];
  pricesByRetailerProduct: Record<string, NormalizedPrice[]>;
} = {
  products: [
    { gtin: '0000000000017', name: 'Sample Rice 5kg', brand: 'SampleBrand', sizeValue: 5, sizeUnit: 'kg', packCount: 1 },
    { gtin: '0000000000024', name: 'Sample Cooking Oil 1L', brand: 'SampleBrand', sizeValue: 1, sizeUnit: 'L', packCount: 1 },
  ],
  pricesByRetailerProduct: {
    'rp-rice': [
      { regularMinor: 30000, saleMinor: 28500, currencyCode: 'PHP', observedAt: '2026-08-12T00:00:00Z', source: 'mock' },
    ],
    'rp-oil': [
      { regularMinor: 12000, currencyCode: 'PHP', observedAt: '2026-08-12T00:00:00Z', source: 'mock' },
    ],
  },
};

export const mockConnector: RetailerConnector = {
  retailerId: 'mock',
  async searchProducts(input: ProductSearchInput): Promise<NormalizedProduct[]> {
    const q = input.query.trim().toLowerCase();
    if (!q) return MOCK_FIXTURE.products;
    return MOCK_FIXTURE.products.filter((p) => p.name.toLowerCase().includes(q));
  },
  async fetchPrice(input: PriceLookupInput): Promise<NormalizedPrice[]> {
    return MOCK_FIXTURE.pricesByRetailerProduct[input.retailerProductId] ?? [];
  },
};
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add features/retail/connectors/mockConnector.ts
git commit -m "feat(5d): reference mock connector (dev/test fixture)"
```

---

### Task 3: `createPrice` source support + reference ingest runner

**Files:**
- Modify: `features/retail/api.ts` (`CreatePriceMinorInput` + `createPrice` accept optional `source`)
- Modify: `features/retail/ingest.ts` (add `ingestFromConnector`)
- Test: `tests/retail/ingest.test.ts` (add a pipeline-composition test)

**Interfaces:**
- Consumes: `RetailerConnector`; `createPrice`, `CreatePriceMinorInput` (retail api); `buildPriceInserts`.
- Produces: `ingestFromConnector(householdId, connector, retailerProductId, storeId?): Promise<number>`.

- [ ] **Step 1: Add optional `source` to `CreatePriceMinorInput` and `createPrice`**

In `features/retail/api.ts`, update the `CreatePriceMinorInput` interface to add
`source?: string;` (after `currencyCode`), and in `createPrice`'s insert object add
`source: input.source ?? 'manual',` (after `currency_code: input.currencyCode,`).
The existing product-price screen call omits `source`, so it keeps defaulting to
`'manual'`.

```typescript
// in CreatePriceMinorInput:
  currencyCode: string;
  source?: string;
```
```typescript
// in createPrice(...).insert({ ... }):
      currency_code: input.currencyCode,
      source: input.source ?? 'manual',
```

- [ ] **Step 2: Add the composition test (write first)**

Append to `tests/retail/ingest.test.ts`:

```typescript
import { mockConnector } from '@/features/retail/connectors/mockConnector';

describe('mockConnector + buildPriceInserts (pipeline composition)', () => {
  it('turns fetched prices into insert rows', async () => {
    const prices = await mockConnector.fetchPrice({ retailerProductId: 'rp-rice' });
    const rows = buildPriceInserts('rp-rice', 'store-1', prices);
    expect(rows).toEqual([
      { retailerProductId: 'rp-rice', storeId: 'store-1', regularMinor: 30000, saleMinor: 28500, currencyCode: 'PHP', source: 'mock' },
    ]);
  });

  it('returns no rows for an unknown retailer product', async () => {
    const prices = await mockConnector.fetchPrice({ retailerProductId: 'nope' });
    expect(buildPriceInserts('nope', undefined, prices)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the composition test to verify it fails**

Run: `npx jest tests/retail/ingest.test.ts`
Expected: FAIL — `mockConnector` import resolves (Task 2) but this asserts new
behavior; it should pass for the mapping but confirm the compose path. (If it
already passes, that's fine — the value is the regression guard.) Proceed.

- [ ] **Step 4: Add the ingest runner**

Append to `features/retail/ingest.ts`:

```typescript
import { createPrice } from '@/features/retail/api';
import type { RetailerConnector } from '@/features/retail/connector';

/**
 * Reference runner: fetch a connector's prices for one retailer_product,
 * normalize, and persist as price_snapshots. Returns how many were inserted.
 * In production this runs inside an Edge Function (secrets server-side); locally
 * it works against the mock connector. Not wired to any screen.
 */
export async function ingestFromConnector(
  householdId: string,
  connector: RetailerConnector,
  retailerProductId: string,
  storeId?: string,
): Promise<number> {
  const prices = await connector.fetchPrice({ retailerProductId, storeId });
  const rows = buildPriceInserts(retailerProductId, storeId, prices);
  for (const row of rows) {
    await createPrice(householdId, {
      retailerProductId: row.retailerProductId,
      storeId: row.storeId,
      regularMinor: row.regularMinor,
      saleMinor: row.saleMinor,
      memberMinor: row.memberMinor,
      currencyCode: row.currencyCode,
      source: row.source,
    });
  }
  return rows.length;
}
```

Note: import lines go at the top of `ingest.ts` with the existing imports — shown
here inline for locality; place them in the import block.

- [ ] **Step 5: Run tests + typecheck**

Run: `npm run typecheck && npx jest tests/retail/ingest.test.ts`
Expected: typecheck clean; all ingest tests pass.

- [ ] **Step 6: Commit**

```bash
git add features/retail/api.ts features/retail/ingest.ts tests/retail/ingest.test.ts
git commit -m "feat(5d): ingest runner + createPrice source support + composition test"
```

---

### Task 4: Final verification

**Files:** none

- [ ] **Step 1: Full sweep**

Run:
```bash
npm run typecheck
npm test
```
Expected: typecheck clean; all unit suites pass, including `tests/retail/ingest.test.ts`.

- [ ] **Step 2: Confirm no stray backend requirement**

5d adds no migration and no `test:rls` change. `createPrice`'s new optional
`source` defaults to `'manual'`, so the existing schema (which already defaults
`source` to `'manual'`) accepts it unchanged.

---

## Self-Review

**Spec coverage:**
- pure `buildPriceInserts` (validate currency, reject bad amounts, map fields) → Task 1 ✓
- reference mock connector (labeled fixture, no network/clipping) → Task 2 ✓
- reference `ingestFromConnector` runner (connector→normalize→persist) → Task 3 ✓
- unit tests for mapping + mock + composition → Tasks 1, 3 ✓
- ADR → written in the spec doc ✓
- deferred items (real adapters, Edge Function deploy, loyalty OAuth, global catalog) → not built ✓

**Placeholder scan:** No TBD/TODO. All code complete.

**Type consistency:** `PriceInsertRow` (Task 1) is mapped field-by-field into
`CreatePriceMinorInput` (extended in Task 3) by `ingestFromConnector`; both carry
`retailerProductId/storeId/regularMinor/saleMinor/memberMinor/currencyCode/source`.
`NormalizedPrice` fields (`regularMinor`, `saleMinor`, `memberMinor`, `currencyCode`,
`source`) match `features/retail/connector.ts`. `mockConnector` satisfies
`RetailerConnector` (Task 2), consumed in Tasks 3.
