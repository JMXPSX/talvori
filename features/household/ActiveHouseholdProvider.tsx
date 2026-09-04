/**
 * Tracks the user's households and the currently-active one. Finance screens
 * (Phase 3) are scoped to the active household. Loads only when authenticated.
 *
 * MVP behavior: defaults to the first household; `setActiveId` lets the user
 * switch. Selection isn't persisted yet — that can be added later.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

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
  // The user id whose households are currently loaded. `loading` is DERIVED from
  // this in render (below), not stored as its own state — so the instant the
  // session changes (e.g. right after login) we report loading=true synchronously,
  // before the async fetch runs. Storing loading as state instead let the auth gate
  // observe a stale "not-loading + empty households" frame right after login and
  // wrongly bounce existing members to onboarding.
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) {
      setHouseholds([]);
      setActiveId(null);
      setLoadedUserId(null);
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
      setLoadedUserId(session.user.id);
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Keep the list in sync across devices: refetch whenever the app/tab returns to
  // the foreground, so a household created on another device shows up here without
  // a full re-login (the session reference doesn't change, so nothing else would
  // trigger a refetch). On web AppState maps to tab visibility; on native to app
  // foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // Derived, not stored (see the note on `loadedUserId`): we're "loading" whenever
  // there is a session whose households haven't been fetched yet. This is stable
  // within a render, so the auth gate never acts on a stale post-login frame.
  const loading = session ? loadedUserId !== session.user.id : false;

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
