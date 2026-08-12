import { bestFloorMinor, compareColumns } from '@/features/retail/basket';

const items = [{ productId: 'a' }, { productId: 'b' }, { productId: 'c' }];
const prices = [
  { productId: 'a', columnKey: 's1', effectiveMinor: 100 },
  { productId: 'b', columnKey: 's1', effectiveMinor: 200 },
  { productId: 'a', columnKey: 's2', effectiveMinor: 90 },
  { productId: 'b', columnKey: 's2', effectiveMinor: 250 },
  { productId: 'c', columnKey: 's2', effectiveMinor: 400 },
];

describe('compareColumns', () => {
  it('totals each column and flags missing items, sorted ascending', () => {
    const cols = compareColumns(items, prices);
    // s1 has a+b priced (300), c missing; s2 has a+b+c (740), none missing.
    expect(cols).toEqual([
      { columnKey: 's1', totalMinor: 300, pricedCount: 2, missingCount: 1 },
      { columnKey: 's2', totalMinor: 740, pricedCount: 3, missingCount: 0 },
    ]);
  });

  it('uses the lowest price if an item repeats in a column', () => {
    const cols = compareColumns([{ productId: 'a' }], [
      { productId: 'a', columnKey: 's1', effectiveMinor: 500 },
      { productId: 'a', columnKey: 's1', effectiveMinor: 300 },
    ]);
    expect(cols).toEqual([{ columnKey: 's1', totalMinor: 300, pricedCount: 1, missingCount: 0 }]);
  });

  it('returns [] when there are no prices', () => {
    expect(compareColumns(items, [])).toEqual([]);
  });
});

describe('bestFloorMinor', () => {
  it('sums the lowest price per item across all columns', () => {
    // a: min(100,90)=90; b: min(200,250)=200; c: 400 => 690, all 3 priced.
    expect(bestFloorMinor(items, prices)).toEqual({ totalMinor: 690, pricedCount: 3 });
  });

  it('counts only items priced somewhere', () => {
    expect(bestFloorMinor(items, [{ productId: 'a', columnKey: 's1', effectiveMinor: 100 }]))
      .toEqual({ totalMinor: 100, pricedCount: 1 });
  });
});
