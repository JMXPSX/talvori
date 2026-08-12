/**
 * Tracks the user's households and the currently-active one. Finance screens
 * (Phase 3) are scoped to the active household. Loads only when authenticated.
 *
 * MVP behavior: defaults to the first household; `setActiveId` lets the user
 * switch. Selection isn't persisted yet — that can be added later.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { listMyHouseholds } from '@/features/household/api';
import type { HouseholdRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';

interface ActiveHouseholdValue {
  loading: boolean;
  households: HouseholdRow[];
  active: HouseholdRow | null;
  errorKey: string | null;
  setActiveId: (id: string) => void;
  refresh: () => Promise<void>;
}

const ActiveHouseholdContext = createContext<ActiveHouseholdValue | undefined>(undefined);

export function ActiveHouseholdProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [households, setHouseholds] = useState<HouseholdRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) {
      setHouseholds([]);
      setActiveId(null);
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      const list = await listMyHouseholds();
      setHouseholds(list);
      setActiveId((prev) => (prev && list.some((h) => h.id === prev) ? prev : list[0]?.id ?? null));
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<ActiveHouseholdValue>(() => {
    const active = households.find((h) => h.id === activeId) ?? households[0] ?? null;
    return { loading, households, active, errorKey, setActiveId, refresh };
  }, [loading, households, activeId, errorKey, refresh]);

  return (
    <ActiveHouseholdContext.Provider value={value}>{children}</ActiveHouseholdContext.Provider>
  );
}

export function useActiveHousehold(): ActiveHouseholdValue {
  const ctx = useContext(ActiveHouseholdContext);
  if (!ctx) throw new Error('useActiveHousehold must be used within <ActiveHouseholdProvider>');
  return ctx;
}
