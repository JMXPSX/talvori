import {
  actualTotalMinor,
  estimatedTotalMinor,
  purchasedCount,
} from '@/features/grocery/totals';

type Item = Parameters<typeof estimatedTotalMinor>[0][number];

function item(over: Partial<Item>): Item {
  return {
    estimated_price_minor: null,
    actual_price_minor: null,
    is_purchased: false,
    ...over,
  } as Item;
}

describe('grocery totals', () => {
  it('sums estimated prices, treating null as 0', () => {
    const items = [
      item({ estimated_price_minor: 1000 }),
      item({ estimated_price_minor: 250 }),
      item({ estimated_price_minor: null }),
    ];
    expect(estimatedTotalMinor(items)).toBe(1250);
  });

  it('sums only purchased items for the actual total', () => {
    const items = [
      item({ actual_price_minor: 999, is_purchased: true }),
      item({ actual_price_minor: 500, is_purchased: false }),
      item({ actual_price_minor: 1, is_purchased: true }),
    ];
    expect(actualTotalMinor(items)).toBe(1000);
  });

  it('treats a purchased item with a null actual price as 0', () => {
    const items = [item({ actual_price_minor: null, is_purchased: true })];
    expect(actualTotalMinor(items)).toBe(0);
  });

  it('counts purchased items', () => {
    const items = [
      item({ is_purchased: true }),
      item({ is_purchased: false }),
      item({ is_purchased: true }),
    ];
    expect(purchasedCount(items)).toBe(2);
  });

  it('returns 0 for an empty list', () => {
    expect(estimatedTotalMinor([])).toBe(0);
    expect(actualTotalMinor([])).toBe(0);
    expect(purchasedCount([])).toBe(0);
  });
});
