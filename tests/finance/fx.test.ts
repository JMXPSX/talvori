/** FX conversion tests — exponent-aware, integer minor units, missing-rate flagging. */

import { convertMinor, sumInReporting } from '@/features/finance/fx';

describe('convertMinor', () => {
  it('is identity for the same currency', () => {
    expect(convertMinor(2599, 'USD', 'USD', 1.23)).toBe(2599);
  });

  it('converts between 2-decimal currencies', () => {
    // 100.00 USD at 56.50 PHP/USD => 5650.00 PHP
    expect(convertMinor(10000, 'USD', 'PHP', 56.5)).toBe(565000);
  });

  it('respects differing minor-unit exponents (USD 2 -> JPY 0)', () => {
    // 10.00 USD at 150 JPY/USD => 1500 JPY (0 decimals => 1500 minor units)
    expect(convertMinor(1000, 'USD', 'JPY', 150)).toBe(1500);
  });

  it('respects JPY 0 -> USD 2', () => {
    // 1500 JPY at 0.0066 USD/JPY => 9.90 USD => 990 minor units
    expect(convertMinor(1500, 'JPY', 'USD', 0.0066)).toBe(990);
  });

  it('handles 3-decimal currencies (BHD)', () => {
    // 1.000 BHD at 2.65 USD/BHD => 2.65 USD => 265 minor units
    expect(convertMinor(1000, 'BHD', 'USD', 2.65)).toBe(265);
  });
});

describe('sumInReporting', () => {
  const rates: Record<string, number> = { 'USD>PHP': 56.5, 'JPY>PHP': 0.38 };
  const rateFor = (from: string, to: string): number | null =>
    rates[`${from}>${to}`] ?? null;

  it('sums mixed currencies into the reporting currency', () => {
    const items = [
      { balanceMinor: 100000, currency: 'PHP' }, // 1000.00 PHP
      { balanceMinor: 10000, currency: 'USD' }, // 100.00 USD -> 5650.00 PHP
    ];
    const { totalMinor, missing } = sumInReporting(items, 'PHP', rateFor);
    expect(totalMinor).toBe(100000 + 565000);
    expect(missing).toEqual([]);
  });

  it('flags currencies with no rate instead of counting them as zero', () => {
    const items = [
      { balanceMinor: 100000, currency: 'PHP' },
      { balanceMinor: 5000, currency: 'SAR' }, // no SAR>PHP rate
    ];
    const { totalMinor, missing } = sumInReporting(items, 'PHP', rateFor);
    expect(totalMinor).toBe(100000);
    expect(missing).toEqual(['SAR']);
  });

  it('reports each missing currency once', () => {
    const items = [
      { balanceMinor: 5000, currency: 'SAR' },
      { balanceMinor: 7000, currency: 'SAR' },
      { balanceMinor: 100, currency: 'AED' },
    ];
    const { totalMinor, missing } = sumInReporting(items, 'PHP', rateFor);
    expect(totalMinor).toBe(0);
    expect(missing.sort()).toEqual(['AED', 'SAR']);
  });

  it('returns zero and no missing for an empty portfolio', () => {
    expect(sumInReporting([], 'PHP', rateFor)).toEqual({ totalMinor: 0, missing: [] });
  });

  it('treats currency codes case-insensitively', () => {
    expect(convertMinor(2599, 'usd', 'USD', 999)).toBe(2599);
    const { totalMinor, missing } = sumInReporting(
      [{ balanceMinor: 100000, currency: 'php' }],
      'PHP',
      rateFor,
    );
    expect(totalMinor).toBe(100000);
    expect(missing).toEqual([]);
  });

  it('sums negative balances (debt accounts) through conversion', () => {
    const items = [
      { balanceMinor: 100000, currency: 'PHP' },
      { balanceMinor: -10000, currency: 'USD' }, // -100.00 USD -> -5650.00 PHP
    ];
    const { totalMinor } = sumInReporting(items, 'PHP', rateFor);
    expect(totalMinor).toBe(100000 - 565000);
  });

  it('rolls up into a 3-decimal reporting currency (KWD)', () => {
    // 100.00 USD at 0.307 KWD/USD => 30.700 KWD => 30700 minor units.
    const kwdRateFor = (from: string, to: string): number | null =>
      from === 'USD' && to === 'KWD' ? 0.307 : null;
    const { totalMinor } = sumInReporting(
      [{ balanceMinor: 10000, currency: 'USD' }],
      'KWD',
      kwdRateFor,
    );
    expect(totalMinor).toBe(30700);
  });
});
