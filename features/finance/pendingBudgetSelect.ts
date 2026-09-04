/**
 * One-shot handoff of a just-created budget's id from the create-month screen to
 * the Budget tab, so returning there selects the new month instead of keeping the
 * previously-viewed one. In-memory (same session, consumed immediately) — no
 * persistence needed.
 */

let pending: string | null = null;

export function setPendingBudgetSelect(id: string): void {
  pending = id;
}

/** Return the pending id (if any) and clear it. */
export function takePendingBudgetSelect(): string | null {
  const id = pending;
  pending = null;
  return id;
}
