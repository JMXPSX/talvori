/**
 * Household (§5.4). Two-column top: the active household's members (roster from
 * listMembers, each with a role pill and a manage affordance) beside a dark
 * Join-code card (the standing code with Copy). Below, a full-width "Your
 * households" card lists every household you belong to with an In-view badge,
 * its code chip and a guarded Leave/Delete. Create / Join with code sit in that
 * card's header. Switching the active household happens in the header pill.
 */

import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import { radius, spacing, elevation } from '@/components/theme';
import { useThemedStyles, useTheme, type Palette } from '@/components/ThemeProvider';
import {
  Avatar,
  BentoPage,
  BentoRow,
  Button,
  Card,
  EmptyState,
  Text,
  useActionSheet,
  useToast,
} from '@/components/ui';
import {
  deleteHousehold,
  leaveHousehold,
  listMembers,
  listMyHouseholds,
  listMyMemberCounts,
  listMyRoles,
  type MemberWithProfile,
} from '@/features/household/api';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { HouseholdRole, HouseholdRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';

/** Tint for a role pill — owner/admin read as the brand accent, the rest neutral. */
function rolePill(c: Palette, role: HouseholdRole): { bg: string; fg: string } {
  if (role === 'owner' || role === 'admin') return { bg: c.primaryTint, fg: c.primary };
  return { bg: c.fill, fg: c.textSecondary };
}

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
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [list, c, r, m] = await Promise.all([
        listMyHouseholds(),
        listMyMemberCounts(),
        listMyRoles(),
        active ? listMembers(active.id) : Promise.resolve<MemberWithProfile[]>([]),
      ]);
      setHouseholds(list);
      setCounts(c);
      setRoles(r);
      setMembers(m);
    } catch (err) {
      setLoadError(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [active]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function onCopyCode() {
    if (!active) return;
    await Clipboard.setStringAsync(active.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

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
      <ScrollView>
        <BentoPage>
          {loadError ? <Text style={{ color: palette.danger }}>{t(loadError)}</Text> : null}

          {loading ? (
            <ActivityIndicator color={palette.brand} />
          ) : !active ? (
            <EmptyState
              icon="home"
              message={t('household.empty')}
              ctaLabel={t('household.createCta')}
              onCta={() => router.push('/household/new')}
            />
          ) : (
            <>
              {/* Row 1 — active household members + dark join-code card. */}
              <BentoRow>
                <Card style={styles.membersSlot}>
                  <View style={styles.cardHead}>
                    <View style={styles.cardHeadText}>
                      <Text variant="subheading" numberOfLines={1}>{active.name}</Text>
                      <Text variant="caption" muted>
                        {t(members.length === 1 ? 'household.activeMembers_one' : 'household.activeMembers_other', { count: members.length })}
                        {' · '}{t('household.reportingIn', { currency: active.reporting_currency_code })}
                      </Text>
                    </View>
                    <Button
                      label={t('household.invite')}
                      onPress={() => router.push(`/household/${active.id}`)}
                      style={styles.inviteBtn}
                    />
                  </View>

                  <View style={styles.list}>
                    {members.map((m) => {
                      const name = m.profile?.display_name || m.profile?.email || m.user_id;
                      const pill = rolePill(palette, m.role);
                      return (
                        <View key={m.user_id} style={styles.memberRow}>
                          <Avatar name={name} size={40} />
                          <View style={styles.memberMid}>
                            <Text variant="button" numberOfLines={1}>{name}</Text>
                            {m.profile?.email ? (
                              <Text variant="caption" muted numberOfLines={1}>{m.profile.email}</Text>
                            ) : null}
                          </View>
                          <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                            <Text variant="caption" style={{ color: pill.fg }}>{t(`household.roles.${m.role}`)}</Text>
                          </View>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t('household.manageMember')}
                            onPress={() => router.push(`/household/${active.id}`)}
                            hitSlop={8}
                            style={({ pressed }) => [styles.manageBtn, pressed ? styles.pressed : null]}
                          >
                            <Feather name="more-horizontal" size={16} color={palette.textSecondary} />
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                </Card>

                <View style={styles.codeSlot}>
                  <View style={styles.codeCard}>
                    <View style={styles.codeTop}>
                      <Text variant="caption" style={styles.codeLabel}>{t('onboarding.inviteCodeLabel')}</Text>
                      <Text style={styles.code}>{active.code}</Text>
                      <Text variant="caption" style={styles.codeHint}>{t('household.joinCodeHint', { name: active.name })}</Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('onboarding.copyCode')}
                      onPress={() => void onCopyCode()}
                      style={({ pressed }) => [styles.copyBtn, pressed ? styles.pressed : null]}
                    >
                      <Feather name={copied ? 'check' : 'copy'} size={15} color={palette.brandNavy} />
                      <Text variant="button" style={styles.copyText}>{copied ? t('onboarding.copied') : t('onboarding.copyCode')}</Text>
                    </Pressable>
                  </View>
                </View>
              </BentoRow>

              {/* Row 2 — every household you belong to. */}
              <BentoRow>
                <Card style={styles.householdsSlot}>
                  <View style={styles.cardHead}>
                    <View style={styles.cardHeadText}>
                      <Text variant="subheading">{t('household.yourHouseholds')}</Text>
                      <Text variant="caption" muted>{t('household.switchHint')}</Text>
                    </View>
                    <View style={styles.headActions}>
                      <Button
                        label={t('home.joinWithCode')}
                        variant="secondary"
                        onPress={() => router.push('/household/join')}
                        style={styles.headBtn}
                      />
                      <Button
                        label={t('household.createCta')}
                        onPress={() => router.push('/household/new')}
                        style={styles.headBtn}
                      />
                    </View>
                  </View>

                  <View style={styles.list}>
                    {households.map((h) => {
                      const owner = roles[h.id] === 'owner';
                      const isActive = h.id === active.id;
                      return (
                        <Pressable
                          key={h.id}
                          accessibilityRole="button"
                          accessibilityLabel={h.name}
                          onPress={() => router.push(`/household/${h.id}`)}
                          style={({ pressed }) => [styles.hhRow, pressed ? styles.pressed : null]}
                        >
                          <View style={styles.hhIcon}>
                            <Feather name="users" size={18} color={palette.primary} />
                          </View>
                          <View style={styles.hhMid}>
                            <View style={styles.hhNameLine}>
                              <Text variant="button" numberOfLines={1}>{h.name}</Text>
                              {isActive ? (
                                <View style={styles.inViewPill}>
                                  <Text variant="caption" style={styles.inViewText}>{t('household.active')}</Text>
                                </View>
                              ) : null}
                            </View>
                            <Text variant="caption" muted>
                              {t(counts[h.id] === 1 ? 'household.activeMembers_one' : 'household.activeMembers_other', { count: counts[h.id] ?? 1 })}
                              {' · '}{t(`household.roles.${roles[h.id] ?? 'member'}`)}
                            </Text>
                          </View>
                          <View style={styles.codeChip}>
                            <Text variant="caption" style={styles.codeChipText}>{h.code}</Text>
                          </View>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t(owner ? 'household.deleteCta' : 'household.leaveCta')}
                            onPress={() => confirmLeaveOrDelete(h, owner)}
                            hitSlop={8}
                            style={({ pressed }) => [styles.leaveBtn, pressed ? styles.pressed : null]}
                          >
                            <Text variant="caption" style={styles.leaveText}>{t(owner ? 'household.deleteCta' : 'household.leaveCta')}</Text>
                          </Pressable>
                          <Feather name="chevron-right" size={18} color={palette.textTertiary} />
                        </Pressable>
                      );
                    })}
                  </View>
                </Card>
              </BentoRow>
            </>
          )}
        </BentoPage>
      </ScrollView>
      {sheet.element}
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  membersSlot: { flex: 1.3, minWidth: 0 },
  householdsSlot: { flex: 1, minWidth: 0 },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  cardHeadText: { flex: 1, minWidth: 0, gap: 2 },
  inviteBtn: { minHeight: 36, paddingHorizontal: spacing.md },
  headActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  headBtn: { minHeight: 36, paddingHorizontal: spacing.md },
  list: { marginTop: spacing.sm },

  // Member rows.
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: c.divider,
  },
  memberMid: { flex: 1, minWidth: 0, gap: 1 },
  pill: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  manageBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.fill,
  },

  // Dark join-code card.
  codeSlot: { flex: 1, minWidth: 0 },
  codeCard: {
    flex: 1,
    justifyContent: 'space-between',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: c.brandNavy,
    boxShadow: elevation.raised,
  },
  codeTop: { gap: spacing.xs },
  codeLabel: { color: c.white, opacity: 0.7 },
  code: { color: c.white, fontSize: 34, fontWeight: '800', letterSpacing: 2 },
  codeHint: { color: c.white, opacity: 0.75 },
  copyBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    backgroundColor: c.white,
  },
  copyText: { color: c.brandNavy },

  // Your-households rows.
  hhRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: c.divider,
  },
  hhIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primaryTint,
  },
  hhMid: { flex: 1, minWidth: 0, gap: 2 },
  hhNameLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inViewPill: { backgroundColor: c.primaryTint, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 1 },
  inViewText: { color: c.primary },
  codeChip: { backgroundColor: c.fill, borderRadius: radius.control, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  codeChipText: { color: c.textSecondary, letterSpacing: 0.5 },
  leaveBtn: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.control,
  },
  leaveText: { color: c.textSecondary },

  pressed: { opacity: 0.6 },
});
