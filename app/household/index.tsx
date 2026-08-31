/**
 * Manage households (§5.4). Lists every household you belong to with its member
 * count, join code, role badge, and an "in view" marker for the active one. Tap a
 * row to open its detail; use the trailing action to Leave (households you joined)
 * or Delete (households you own — cascades all data). Create / Join live at the
 * bottom. Switching the active household happens in the Home switcher popover.
 */

import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, spacing } from '@/components/theme';
import { useThemedStyles, useTheme, type Palette } from '@/components/ThemeProvider';
import { Avatar, Button, Card, CONTENT_MAX_WIDTH, EmptyState, Text, useActionSheet, useToast } from '@/components/ui';
import {
  deleteHousehold,
  leaveHousehold,
  listMyHouseholds,
  listMyMemberCounts,
  listMyRoles,
} from '@/features/household/api';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { HouseholdRole, HouseholdRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';

export default function HouseholdsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const sheet = useActionSheet();
  const toast = useToast();
  const styles = useThemedStyles(makeStyles);
  const { palette } = useTheme();
  const { active, refresh: refreshActive } = useActiveHousehold();

  const [households, setHouseholds] = useState<HouseholdRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [roles, setRoles] = useState<Record<string, HouseholdRole>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [list, c, r] = await Promise.all([listMyHouseholds(), listMyMemberCounts(), listMyRoles()]);
      setHouseholds(list);
      setCounts(c);
      setRoles(r);
    } catch (err) {
      setLoadError(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  function confirmLeaveOrDelete(h: HouseholdRow, owner: boolean) {
    sheet.show({
      title: t(owner ? 'household.deleteConfirmTitle' : 'household.leaveConfirmTitle', { name: h.name }),
      message: t(owner ? 'household.deleteConfirmBody' : 'household.leaveConfirmBody'),
      cancelLabel: t('common.cancel'),
      actions: [
        {
          label: t(owner ? 'household.deleteCta' : 'household.leaveCta'),
          destructive: true,
          onPress: () => {
            void (async () => {
              try {
                if (owner) await deleteHousehold(h.id);
                else await leaveHousehold(h.id);
                toast.show(t(owner ? 'household.deletedToast' : 'household.leftToast', { name: h.name }), { tone: 'success' });
                await refreshActive();
                await load();
              } catch (err) {
                toast.show(t(toAppError(err).messageKey), { tone: 'error' });
              }
            })();
          },
        },
      ],
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text variant="title">{t('household.manageTitle')}</Text>
          <Text muted>{t('household.manageSub')}</Text>
        </View>

        {loadError ? <Text style={{ color: palette.danger }}>{t(loadError)}</Text> : null}

        {loading ? (
          <ActivityIndicator color={palette.brand} />
        ) : households.length === 0 ? (
          <EmptyState icon="home" message={t('household.empty')} ctaLabel={t('household.createCta')} onCta={() => router.push('/household/new')} />
        ) : (
          <Card>
            {households.map((h, i) => {
              const owner = roles[h.id] === 'owner';
              const isActive = h.id === active?.id;
              return (
                <View key={h.id} style={[styles.row, i > 0 ? styles.divider : null]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={h.name}
                    onPress={() => router.push(`/household/${h.id}`)}
                    style={styles.rowMain}
                  >
                    <Avatar name={h.name} size={40} />
                    <View style={styles.rowMid}>
                      <View style={styles.nameLine}>
                        <Text variant="button" numberOfLines={1}>{h.name}</Text>
                        {isActive ? <View style={styles.activePill}><Text variant="caption" style={styles.activeText}>{t('household.active')}</Text></View> : null}
                      </View>
                      <Text variant="caption" muted>
                        {t(counts[h.id] === 1 ? 'household.activeMembers_one' : 'household.activeMembers_other', { count: counts[h.id] ?? 1 })}
                        {' · '}{h.code}{' · '}{t(`household.roles.${roles[h.id] ?? 'member'}`)}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={20} color={palette.textTertiary} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t(owner ? 'household.deleteCta' : 'household.leaveCta')}
                    onPress={() => confirmLeaveOrDelete(h, owner)}
                    hitSlop={8}
                    style={styles.action}
                  >
                    <Text variant="caption" style={styles.actionText}>{t(owner ? 'household.deleteCta' : 'household.leaveCta')}</Text>
                  </Pressable>
                </View>
              );
            })}
          </Card>
        )}

        <View style={styles.footer}>
          <Button label={t('household.createCta')} onPress={() => router.push('/household/new')} />
          <Button label={t('home.joinWithCode')} variant="secondary" onPress={() => router.push('/household/join')} />
        </View>
      </ScrollView>
      {sheet.element}
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  content: { padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  divider: { borderTopWidth: 1, borderTopColor: c.divider },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowMid: { flex: 1, gap: 2 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  activePill: { backgroundColor: c.primaryTint, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 1 },
  activeText: { color: c.primary },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  actionText: { color: c.danger },
  footer: { gap: spacing.sm, marginTop: spacing.sm },
});
