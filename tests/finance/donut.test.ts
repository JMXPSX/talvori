import { donutArcs } from '@/features/finance/donut';

describe('donutArcs', () => {
  it('splits values into fractions with cumulative offsets', () => {
    expect(donutArcs([1, 1, 2])).toEqual([
      { fraction: 0.25, offset: 0 },
      { fraction: 0.25, offset: 0.25 },
      { fraction: 0.5, offset: 0.5 },
    ]);
  });

  it('ignores negatives and returns [] when the total is zero', () => {
    expect(donutArcs([])).toEqual([]);
    expect(donutArcs([0, 0])).toEqual([]);
    expect(donutArcs([-5])).toEqual([]);
  });

  it('offsets accumulate to (nearly) 1 across all arcs', () => {
    const arcs = donutArcs([3, 1]);
    expect(arcs[0]).toEqual({ fraction: 0.75, offset: 0 });
    expect(arcs[1]).toEqual({ fraction: 0.25, offset: 0.75 });
  });
});
