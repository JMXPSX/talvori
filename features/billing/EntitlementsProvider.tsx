/**
 * Resolves the active household's plan into capabilities for gating. Reloads when
 * the active household changes; `refresh()` re-reads after a plan change.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getHouseholdSubscription } from '@/features/billing/api';
import type { Capability, PlanCode } from '@/features/billing/plans';
import { planIncludes, resolvePlan } from '@/features/billing/plans';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';

interface EntitlementsValue {
  plan: PlanCode;
  has: (c: Capability) => boolean;
  loading: boolean;
  refresh: () => void;
}

const EntitlementsContext = createContext<EntitlementsValue | null>(null);

export function EntitlementsProvider({ children }: { children: React.ReactNode }) {
  const { active } = useActiveHousehold();
  const [plan, setPlan] = useState<PlanCode>('free');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!active) {
      setPlan('free');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const sub = await getHouseholdSubscription(active.id);
      setPlan(resolvePlan(sub, Date.now()));
    } catch {
      setPlan('free'); // fail closed
    } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo<EntitlementsValue>(
    () => ({ plan, has: (c) => planIncludes(plan, c), loading, refresh: () => void load() }),
    [plan, loading, load],
  );

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
}

export function usePlan(): EntitlementsValue {
  const ctx = useContext(EntitlementsContext);
  if (!ctx) throw new Error('usePlan must be used within <EntitlementsProvider>');
  return ctx;
}
