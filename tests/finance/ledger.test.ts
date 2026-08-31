/** Per-account ledger (money-model #5) — In/Out/Net per account for one month,
 *  each in the account's own currency. Transfers count both legs; out-direction
 *  goal/debt payments fall into Out. */

import { accountLedger, type LedgerAccount, type LedgerTxn } from '@/features/finance/ledger';

const checking: LedgerAccount = { id: 'chk', currency_code: 'PHP' };
const savings: LedgerAccount = { id: 'sav', currency_code: 'PHP' };
const usd: LedgerAccount = { id: 'usd', currency_code: 'USD' };

const tx = (over: Partial<LedgerTxn>): LedgerTxn => ({
  account_id: 'chk',
  direction: 'out',
  amount_minor: 1000,
  occurred_at: '2026-08-10T00:00:00Z',
  ...over,
});

describe('accountLedger', () => {
  it('returns a zeroed row per account, in list order, when there is no activity', () => {
    const rows = accountLedger([checking, savings], [], '2026-08');
    expect(rows).toEqual([
      { accountId: 'chk', currency: 'PHP', inMinor: 0, outMinor: 0, netMinor: 0 },
      { accountId: 'sav', currency: 'PHP', inMinor: 0, outMinor: 0, netMinor: 0 },
    ]);
  });

  it('sums In and Out per account and derives Net', () => {
    const rows = accountLedger(
      [checking, savings],
      [
        tx({ account_id: 'chk', direction: 'in', amount_minor: 50000 }), // salary
        tx({ account_id: 'chk', direction: 'out', amount_minor: 12000 }), // groceries
        tx({ account_id: 'chk', direction: 'out', amount_minor: 3000 }), // coffee
        tx({ account_id: 'sav', direction: 'in', amount_minor: 20000 }),
      ],
      '2026-08',
    );
    expect(rows[0]).toEqual({ accountId: 'chk', currency: 'PHP', inMinor: 50000, outMinor: 15000, netMinor: 35000 });
    expect(rows[1]).toEqual({ accountId: 'sav', currency: 'PHP', inMinor: 20000, outMinor: 0, netMinor: 20000 });
  });

  it('counts both transfer legs — out on source, in on destination', () => {
    // A transfer is two rows sharing a transfer_group_id, one per account.
    const rows = accountLedger(
      [checking, savings],
      [
        tx({ account_id: 'chk', direction: 'out', amount_minor: 10000 }), // transfer-out leg
        tx({ account_id: 'sav', direction: 'in', amount_minor: 10000 }), // transfer-in leg
      ],
      '2026-08',
    );
    expect(rows[0]).toMatchObject({ outMinor: 10000, inMinor: 0, netMinor: -10000 });
    expect(rows[1]).toMatchObject({ inMinor: 10000, outMinor: 0, netMinor: 10000 });
  });

  it('ignores transactions outside the month', () => {
    const rows = accountLedger(
      [checking],
      [
        tx({ direction: 'in', amount_minor: 5000 }),
        tx({ direction: 'in', amount_minor: 9999, occurred_at: '2026-07-31T23:59:00Z' }), // prev month
        tx({ direction: 'out', amount_minor: 7777, occurred_at: '2026-09-01T00:00:00Z' }), // next month
      ],
      '2026-08',
    );
    expect(rows[0]).toEqual({ accountId: 'chk', currency: 'PHP', inMinor: 5000, outMinor: 0, netMinor: 5000 });
  });

  it('keeps each account in its own currency and skips unknown accounts', () => {
    const rows = accountLedger(
      [checking, usd],
      [
        tx({ account_id: 'chk', direction: 'out', amount_minor: 1500 }),
        tx({ account_id: 'usd', direction: 'out', amount_minor: 250 }),
        tx({ account_id: 'ghost', direction: 'out', amount_minor: 999 }), // archived/hidden account
      ],
      '2026-08',
    );
    expect(rows).toEqual([
      { accountId: 'chk', currency: 'PHP', inMinor: 0, outMinor: 1500, netMinor: -1500 },
      { accountId: 'usd', currency: 'USD', inMinor: 0, outMinor: 250, netMinor: -250 },
    ]);
  });
});
