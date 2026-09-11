/** Notifications (App & Account) — the household activity feed: what any member
 *  did recently (added a grocery item, recorded a transaction, joined, …).
 *  Opening the screen stamps the seen watermark, clearing the unread badge. */

import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing } from '@/components/theme';
import { useThemedStyles, type Palette } from '@/components/ThemeProvider';
import { Avatar, Card, CONTENT_MAX_WIDTH, EmptyState, Text } from '@/components/ui';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { listNotifications, markSeen } from '@/features/notifications/api';
import { formatNotification } from '@/features/notifications/format';
import { useNotifications } from '@/features/notifications/NotificationsProvider';
import type { NotificationRow } from '@/lib/database.types';
import { formatDateTime } from '@/lib/format';

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { active } = useActiveHousehold();
  const { refresh } = useNotifications();
  const styles = useThemedStyles(makeStyles);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    // setState only in async continuations (never synchronously in the effect body).
    listNotifications(active.id)
      .then((r) => alive && setRows(r))
      .catch(() => alive && setRows([]))
      .then(() => alive && setLoading(false));
    // Opening the list clears unread for this member.
    void markSeen(active.id)
      .then(() => refresh())
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [active, refresh]);

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: t('notifications.title') }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text variant="title">{t('notifications.title')}</Text>
          <Text muted>{t('notifications.sub')}</Text>
        </View>

        {!active || loading ? null : rows.length === 0 ? (
          <EmptyState icon="bell" message={t('notifications.empty')} />
        ) : (
          <Card>
            {rows.map((n, i) => (
              <View key={n.id} style={[styles.row, i > 0 ? styles.divider : null]}>
                <Avatar name={n.actor_name} size={38} />
                <View style={styles.rowMid}>
                  <Text variant="button">{formatNotification(t, n)}</Text>
                  <Text variant="caption" muted>{formatDateTime(n.created_at)}</Text>
                </View>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  rowMid: { flex: 1, gap: 2 },
  divider: { borderTopWidth: 1, borderTopColor: c.divider },
});
