/**
 * Household detail: members list, invite-by-email form, and pending invitations.
 * Writes are RLS-gated (owner/admin only) — the DB rejects unauthorized changes
 * even if the UI is bypassed.
 */

import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { elevation, palette, radius, spacing } from '@/components/theme';
import { Button, CONTENT_MAX_WIDTH, Text, TextField } from '@/components/ui';
import {
  inviteMember,
  listMembers,
  listPendingInvitations,
  revokeInvitation,
  type MemberWithProfile,
} from '@/features/household/api';
import { invitableRoleSchema, inviteMemberSchema } from '@/features/household/schemas';
import { useAuth } from '@/features/auth/AuthProvider';
import type { HouseholdInvitationRow, HouseholdRole } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { validate } from '@/lib/validation';

const INVITABLE_ROLES = invitableRoleSchema.options;

export default function HouseholdDetailScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const householdId = String(id);

  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [invitations, setInvitations] = useState<HouseholdInvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<HouseholdRole>('member');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastInvite, setLastInvite] = useState<HouseholdInvitationRow | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [m, inv] = await Promise.all([
        listMembers(householdId),
        listPendingInvitations(householdId),
      ]);
      setMembers(m);
      setInvitations(inv);
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

  async function onInvite() {
    setFormError(null);
    setLastInvite(null);
    const result = validate(inviteMemberSchema, { email, role });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const created = await inviteMember(householdId, result.data);
      setLastInvite(created);
      setEmail('');
      await load();
    } catch (err) {
      setFormError(toAppError(err).messageKey);
    } finally {
      setSubmitting(false);
    }
  }

  async function onRevoke(invitationId: string) {
    try {
      await revokeInvitation(invitationId);
      await load();
    } catch (err) {
      setFormError(toAppError(err).messageKey);
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
      <ScrollView contentContainerStyle={styles.content}>
        {loadError ? <Text style={{ color: palette.danger }}>{t(loadError)}</Text> : null}

        <Text variant="heading">{t('household.membersTitle')}</Text>
        <View style={styles.list}>
          {members.map((m) => (
            <View key={m.user_id} style={styles.card}>
              <Text>
                {m.profile?.display_name || m.profile?.email || m.user_id}
                {m.user_id === user?.id ? ` ${t('household.you')}` : ''}
              </Text>
              <Text variant="caption" muted>
                {t(`household.roles.${m.role}`)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        <Text variant="heading">{t('household.inviteTitle')}</Text>
        <View style={styles.form}>
          <TextField
            label={t('auth.emailLabel')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            error={fieldErrors.email ? t('errors.validation') : undefined}
          />
          <Text variant="caption" muted>
            {t('household.roleLabel')}
          </Text>
          <View style={styles.chips}>
            {INVITABLE_ROLES.map((r) => {
              const active = r === role;
              return (
                <Pressable
                  key={r}
                  onPress={() => setRole(r)}
                  style={[styles.chip, active ? styles.chipActive : null]}
                >
                  <Text
                    variant="caption"
                    style={{ color: active ? palette.white : palette.text }}
                  >
                    {t(`household.roles.${r}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {formError ? (
            <Text variant="caption" style={{ color: palette.danger }}>
              {t(formError)}
            </Text>
          ) : null}

          <Button
            label={submitting ? t('auth.processing') : t('household.inviteCta')}
            onPress={onInvite}
            loading={submitting}
          />

          {lastInvite ? (
            <View style={styles.tokenBox}>
              <Text variant="caption" style={{ color: palette.success }}>
                {t('household.inviteCreatedTitle')}
              </Text>
              <Text variant="caption" muted>
                {t('household.inviteCreatedBody', { email: lastInvite.email })}
              </Text>
              <Text selectable style={styles.token}>
                {lastInvite.token}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.divider} />

        <Text variant="heading">{t('household.invitationsTitle')}</Text>
        {invitations.length === 0 ? (
          <Text muted>{t('household.noInvitations')}</Text>
        ) : (
          <View style={styles.list}>
            {invitations.map((inv) => (
              <View key={inv.id} style={styles.card}>
                <Text>{inv.email}</Text>
                <Text variant="caption" muted>
                  {t(`household.roles.${inv.role}`)}
                </Text>
                <Pressable onPress={() => onRevoke(inv.id)}>
                  <Text variant="caption" style={{ color: palette.danger }}>
                    {t('household.revoke')}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    // Cap + centre so the screen does not stretch edge to edge on a monitor.
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  list: { gap: spacing.sm },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
    boxShadow: elevation.tile,
    gap: spacing.xs,
  },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
  form: { gap: spacing.sm },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: palette.field,
  },
  chipActive: { backgroundColor: palette.brand },
  tokenBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.brandMuted,
    gap: spacing.xs,
  },
  token: { fontFamily: 'monospace', color: palette.text },
});
