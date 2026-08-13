/** Pure export shaper tests (Phase 8 QA item 3 — data portability). */

import { buildExport, exportFilename, type HouseholdExportBundle } from '@/features/account/export';
import type { HouseholdRow } from '@/lib/database.types';

const household = (id: string, name: string): HouseholdRow =>
  ({
    id,
    name,
    reporting_currency_code: 'USD',
    is_cross_border: false,
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }) as HouseholdRow;

const emptyBundle = (id: string, name: string): HouseholdExportBundle => ({
  household: household(id, name),
  members: [],
  accounts: [],
  balances: [],
  categories: [],
  transactions: [],
  fxRates: [],
  budgets: [],
  budgetStatus: [],
  goals: [],
  goalStatus: [],
  debts: [],
  debtStatus: [],
  grocery: { lists: [], items: {} },
  retail: { retailers: [], stores: [], products: [], prices: [] },
  coupons: [],
  savedLocations: [],
});

describe('exportFilename', () => {
  it('derives a sortable name from the ISO timestamp only', () => {
    expect(exportFilename('2026-08-13T01:23:45.678Z')).toBe('household-export-20260813-012345.json');
  });
});

describe('buildExport', () => {
  const user = { id: 'user-1', email: 'a@b.c' };

  it('stamps user and exportedAt', () => {
    const out = buildExport(user, [], '2026-08-13T01:23:45.000Z');
    expect(out.exportedAt).toBe('2026-08-13T01:23:45.000Z');
    expect(out.user).toEqual(user);
    expect(out.households).toEqual([]);
  });

  it('sorts households by name without mutating the input', () => {
    const bundles = [emptyBundle('h2', 'Zeta'), emptyBundle('h1', 'Alpha')];
    const out = buildExport(user, bundles, '2026-08-13T01:23:45.000Z');
    expect(out.households.map((b) => b.household.name)).toEqual(['Alpha', 'Zeta']);
    expect(bundles.map((b) => b.household.name)).toEqual(['Zeta', 'Alpha']);
  });

  it('serializes cleanly to JSON', () => {
    const out = buildExport(user, [emptyBundle('h1', 'Alpha')], '2026-08-13T01:23:45.000Z');
    const parsed = JSON.parse(JSON.stringify(out));
    expect(parsed.households[0].household.id).toBe('h1');
  });
});
