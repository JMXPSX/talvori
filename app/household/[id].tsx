/**
 * Household (§6.11) — the active household's people. A card with the name, the
 * roster-derived member count and reporting currency, and an Invite panel showing
 * the standing join CODE (Copy / Share). Member rows carry an avatar, role line and
 * a role badge. A roles card explains each role; owners/admins get the cross-border
 * toggle. All writes are RLS-gated (the DB rejects unauthorized changes).
 */

import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import { radius, spacing } from '@/components/theme';
import { useThemedStyles, useTheme, type Palette } from '@/components/ThemeProvider';
import { Avatar, Button, Card, CONTENT_MAX_WIDTH, Text, Toggle } from '@/components/ui';
import { getHousehold, listMembers, setCrossBorder, type MemberWithProfile } from '@/features/household/api';
import { useAuth } from '@/features/auth/AuthProvider';
import type { HouseholdRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';

export default function HouseholdDetailScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const householdId = String(id);
  const styles = useThemedStyles(makeStyles);
  const { palette } = useTheme();

  const [household, setHousehold] = useState<HouseholdRow | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [h, m] = await Promise.all([getHousehold(householdId), listMembers(householdId)]);
      setHousehold(h);
      setMembers(m);
    } catch (err) {
      setLoadError(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const me = members.find((m) => m.user_id === user?.id);
  const canManage = me?.role === 'owner' || me?.role === 'admin';

  async function onCopy() {
    if (!household) return;
    await Clipboard.setStringAsync(household.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  async function onShare() {
    if (household) await Share.share({ message: household.code });
  }
  async function onToggleCrossBorder(value: boolean) {
    if (!household) return;
    setHousehold({ ...household, is_cross_border: value });
    try {
      await setCrossBorder(household.id, value);
    } catch (err) {
      setHousehold({ ...household, is_cross_border: !value });
      setLoadError(toAppError(err).messageKey);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centered} edges={['left', 'right', 'bottom']}>
        <ActivityIndicator color={palette.brand} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: t('screens.moreTitle') }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text variant="title">{household?.name ?? ''}</Text>
          <Text muted>{t('household.detailSub')}</Text>
        </View>

        {loadError ? <Text style={{ color: palette.danger }}>{t(loadError)}</Text> : null}

        {/* Household card — name, member count · currency, Invite (code panel). */}
        <Card>
          <View style={styles.rowBetween}>
            <View style={styles.rowMid}>
              <Text variant="subheading">{household?.name ?? ''}</Text>
              <Text variant="caption" muted>
                {t(members.length === 1 ? 'household.activeMembers_one' : 'household.activeMembers_other', { count: members.length })}
                {' · '}{household?.reporting_currency_code}
              </Text>
            </View>
            <Button
              label={inviteOpen ? t('household.close') : t('household.invite')}
              variant={inviteOpen ? 'secondary' : 'primary'}
              onPress={() => setInviteOpen((o) => !o)}
              style={styles.inviteBtn}
            />
          </View>
          {inviteOpen ? (
            <View style={styles.invitePanel}>
              <Text variant="eyebrow" muted style={styles.center}>{t('onboarding.inviteCodeLabel')}</Text>
              <Text style={styles.code}>{household?.code}</Text>
              <View style={styles.inviteActions}>
                <Pressable accessibilityRole="button" onPress={onCopy} style={[styles.pill, styles.pillTint]}>
                  <Text variant="button" style={styles.pillTintText}>{copied ? t('onboarding.copied') : t('onboarding.copyCode')}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={onShare} style={[styles.pill, styles.pillOutline]}>
                  <Text variant="button">{t('onboarding.share')}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </Card>

        {/* Members */}
        <Card>
          {members.map((m, i) => {
            const name = m.profile?.display_name || m.profile?.email || m.user_id;
            const isOwner = m.role === 'owner';
            const roleLine = `${t(`household.roles.${m.role}`)} · ${isOwner ? t('household.ownerAccess') : t('household.memberAccess')}`;
            return (
              <View key={m.user_id} style={[styles.memberRow, i > 0 ? styles.divider : null]}>
                <Avatar name={name} size={40} variant={m.user_id === user?.id ? 'self' : 'default'} />
                <View style={styles.rowMid}>
                  <Text variant="button">{name}{m.user_id === user?.id ? ` ${t('household.you')}` : ''}</Text>
                  <Text variant="caption" muted>{roleLine}</Text>
                </View>
                <View style={[styles.badge, isOwner ? styles.badgeOwner : styles.badgeMember]}>
                  <Text variant="caption" style={isOwner ? styles.badgeOwnerText : undefined}>{t(`household.roles.${m.role}`)}</Text>
                </View>
              </View>
            );
          })}
        </Card>

        {/* Roles explainer */}
        <Card>
          <Text variant="subheading">{t('household.rolesTitle')}</Text>
          <Text variant="button" style={styles.roleHead}>{t('household.roles.owner')}</Text>
          <Text variant="caption" muted>{t('household.ownerCan')}</Text>
          <Text variant="button" style={styles.roleHead}>{t('household.roles.member')}</Text>
          <Text variant="caption" muted>{t('household.memberCan')}</Text>
        </Card>

        {/* Cross-border toggle (owner/admin) */}
        {canManage ? (
          <Card>
            <View style={styles.rowBetween}>
              <Text variant="button" style={styles.rowMid}>{t('household.crossBorderToggle')}</Text>
              <Toggle
                value={household?.is_cross_border ?? false}
                onValueChange={onToggleCrossBorder}
                accessibilityLabel={t('household.crossBorderToggle')}
              />
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
  content: { padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  rowMid: { flex: 1, gap: 2 },
  inviteBtn: { minHeight: 40, paddingHorizontal: spacing.md },
  invitePanel: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  center: { textAlign: 'center' },
  code: { fontSize: 28, fontWeight: '800', color: c.primary, letterSpacing: 4 },
  inviteActions: { flexDirection: 'row', gap: spacing.sm },
  pill: { minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  pillTint: { backgroundColor: c.primaryTint },
  pillTintText: { color: c.primary },
  pillOutline: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  divider: { borderTopWidth: 1, borderTopColor: c.divider },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  badgeOwner: { backgroundColor: c.primaryTint },
  badgeMember: { backgroundColor: c.fill },
  badgeOwnerText: { color: c.primary },
  roleHead: { marginTop: spacing.sm },
});
