/**
 * Live unread-count for the household activity feed, plus a toast when another
 * member does something while you're in the app. Sits under ToastProvider (uses
 * useToast) and inside the household/auth providers. The badge in the top bar,
 * the More tab, and the More screen all read `count` from here.
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { subscribeToNotifications, unreadCount } from '@/features/notifications/api';
import { formatNotification } from '@/features/notifications/format';

interface NotificationsContextValue {
  count: number;
  /** Re-read the unread count (e.g. after marking seen). */
  refresh: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue>({ count: 0, refresh: () => {} });

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { active } = useActiveHousehold();
  const { user } = useAuth();
  const toast = useToast();
  const { t } = useTranslation();
  const [count, setCount] = useState(0);

  const householdId = active?.id ?? null;

  const refresh = useCallback(() => {
    if (!householdId) {
      setCount(0);
      return;
    }
    void unreadCount(householdId)
      .then(setCount)
      .catch(() => {
        /* offline / transient — keep the last known count */
      });
  }, [householdId]);

  useEffect(() => {
    refresh();
    if (!householdId) return;
    const unsub = subscribeToNotifications(householdId, (row) => {
      refresh();
      // Toast only for other members' actions — you don't need to be told what you just did.
      if (row.actor_id && row.actor_id !== user?.id) {
        toast.show(formatNotification(t, row), { tone: 'info' });
      }
    });
    return unsub;
  }, [householdId, refresh, toast, t, user?.id]);

  return (
    <NotificationsContext.Provider value={{ count, refresh }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  return useContext(NotificationsContext);
}
