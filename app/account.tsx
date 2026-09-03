/** Account screen: full-data export and guarded account deletion (Phase 8).
 *  Deletion is armed by re-typing the account email, then confirmed via the
 *  cross-platform ActionSheet — the interim step-up until MFA lands. */

import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing } from '@/components/theme';
import { useThemedStyles, type Palette } from '@/components/ThemeProvider';
import { Avatar, Button, Card, Chip, CONTENT_MAX_WIDTH, ErrorNotice, Text, TextField, useActionSheet, useToast } from '@/components/ui';
import { deleteMyAccount, uploadAvatar } from '@/features/account/api';
import { exportFilename } from '@/features/account/export';
import { assembleExport } from '@/features/account/exportApi';
import { saveExport } from '@/features/account/saveExport';
import { useAuth } from '@/features/auth/AuthProvider';
import { setHouseholdPlan } from '@/features/billing/api';
import { usePlan } from '@/features/billing/EntitlementsProvider';
import type { PlanCode } from '@/features/billing/plans';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { toAppError } from '@/lib/errors';

export default function AccountScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, signOut, updateProfile } = useAuth();
  const { plan, refresh: refreshPlan } = usePlan();
  const { active } = useActiveHousehold();
  const sheet = useActionSheet();
  const { show: showToast } = useToast();
  const styles = useThemedStyles(makeStyles);

  const [signingOut, setSigningOut] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportErrorKey, setExportErrorKey] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteErrorKey, setDeleteErrorKey] = useState<string | null>(null);

  const email = user?.email ?? '';
  const displayName =
    (typeof user?.user_metadata?.display_name === 'string' && user.user_metadata.display_name) || '';
  const photoUrl =
    (typeof user?.user_metadata?.avatar_url === 'string' && user.user_metadata.avatar_url) || null;
  const armed = confirmEmail.trim().toLowerCase() === email.toLowerCase() && email.length > 0;

  // Editable profile fields, seeded from the current user.
  const [name, setName] = useState(displayName);
  const [emailInput, setEmailInput] = useState(email);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profileErrorKey, setProfileErrorKey] = useState<string | null>(null);
  const [emailPending, setEmailPending] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);
  const [planErrorKey, setPlanErrorKey] = useState<string | null>(null);

  // Subscription plan (§6a). Switching writes the owner-checked RPC; it stays a
  // DEV-only affordance so it can't be a free-premium hole in production — real
  // upgrades arrive with billing (6b). Non-owners / prod see the plan read-only.
  const isOwner = Boolean(active && user && active.created_by === user.id);
  const canSwitchPlan = isOwner && __DEV__;
  const planOptions: { code: PlanCode; label: string }[] = [
    { code: 'free', label: t('more.planFree') },
    { code: 'premium', label: t('more.planPremium') },
  ];

  async function onSelectPlan(code: PlanCode) {
    if (!active || !canSwitchPlan || code === plan || planBusy) return;
    setPlanBusy(true);
    setPlanErrorKey(null);
    try {
      await setHouseholdPlan(active.id, code);
      refreshPlan();
    } catch (err) {
      setPlanErrorKey(toAppError(err).messageKey);
    } finally {
      setPlanBusy(false);
    }
  }

  const nextName = name.trim();
  const nextEmail = emailInput.trim();
  const emailChanged = nextEmail.toLowerCase() !== email.toLowerCase();
  const profileDirty = nextName !== displayName || emailChanged;

  async function onPickPhoto() {
    if (!user) return;
    setProfileErrorKey(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setProfileErrorKey('account.errors.photoPermission');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadAvatar(user.id, { uri: asset.uri, mimeType: asset.mimeType });
      await updateProfile({ avatarUrl: url });
      showToast(t('account.photoSaved'));
    } catch (err) {
      setProfileErrorKey(toAppError(err).messageKey);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function onSaveProfile() {
    setProfileErrorKey(null);
    setEmailPending(false);
    if (emailChanged && !/.+@.+\..+/.test(nextEmail)) {
      setProfileErrorKey('errors.validation');
      return;
    }
    setSavingProfile(true);
    try {
      const { emailChangePending } = await updateProfile({
        displayName: nextName,
        email: emailChanged ? nextEmail : undefined,
      });
      if (emailChangePending) setEmailPending(true);
      showToast(t('account.profileSaved'));
    } catch (err) {
      setProfileErrorKey(toAppError(err).messageKey);
    } finally {
      setSavingProfile(false);
    }
  }

  async function onSignOut() {
    setSigningOut(true);
    try {
      await signOut(); // auth gate redirects to /login
    } finally {
      setSigningOut(false);
    }
  }

  async function onExport() {
    if (!user) return;
    setExportErrorKey(null);
    setExporting(true);
    try {
      const exportedAt = new Date().toISOString();
      const data = await assembleExport({ id: user.id, email: user.email ?? null }, exportedAt);
      await saveExport(JSON.stringify(data, null, 2), exportFilename(exportedAt));
    } catch (err) {
      setExportErrorKey(toAppError(err).messageKey ?? 'account.errors.exportFailed');
    } finally {
      setExporting(false);
    }
  }

  function onDeletePressed() {
    sheet.show({
      title: t('account.confirmTitle'),
      message: t('account.confirmBody'),
      cancelLabel: t('common.cancel'),
      actions: [
        {
          label: t('account.deleteCta'),
          destructive: true,
          onPress: () => {
            void (async () => {
              setDeleteErrorKey(null);
              setDeleting(true);
              try {
                await deleteMyAccount();
                await signOut(); // auth gate redirects to /login
              } catch (err) {
                setDeleteErrorKey(toAppError(err).messageKey);
                setDeleting(false);
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
        {/* Profile identity (§6.15) — photo + editable name/email. */}
        <Card>
          <View style={styles.profileRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('account.changePhoto')}
              onPress={() => void onPickPhoto()}
              disabled={uploadingPhoto}
              style={({ pressed }) => [styles.avatarPress, pressed ? styles.pressed : null]}
            >
              <Avatar name={name || email} photoUrl={photoUrl} size={64} variant="self" />
              <Text variant="caption" style={styles.changePhoto}>
                {uploadingPhoto ? t('common.loading') : t('account.changePhoto')}
              </Text>
            </Pressable>
            <View style={styles.profileMid}>
              <Text variant="subheading">{name || email.split('@')[0]}</Text>
              <Text variant="caption" muted>{t(plan === 'premium' ? 'more.planPremium' : 'more.planFree')}</Text>
            </View>
          </View>

          <TextField
            label={t('account.nameLabel')}
            value={name}
            onChangeText={(v) => setName(v.slice(0, 80))}
            autoCapitalize="words"
          />
          <TextField
            label={t('account.emailLabel')}
            value={emailInput}
            onChangeText={setEmailInput}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          {emailPending ? (
            <Text variant="caption" style={styles.notice}>{t('account.emailChangePending')}</Text>
          ) : null}
          {profileErrorKey ? (
            <ErrorNotice message={t(profileErrorKey)} retryLabel={t('common.retry')} onRetry={() => void onSaveProfile()} />
          ) : null}
          <Button
            label={t('account.saveProfile')}
            onPress={onSaveProfile}
            loading={savingProfile}
            disabled={!profileDirty}
          />
        </Card>

        {/* Subscription plan — current plan + selectable options (restored from
            the Flow prototype's Profile). Switching is owner + DEV-gated. */}
        <Card>
          <View style={styles.planHead}>
            <Text variant="subheading">{t('account.subscriptionPlan')}</Text>
            <Text variant="button" style={styles.planName}>
              {t(plan === 'premium' ? 'more.planPremium' : 'more.planFree')}
            </Text>
          </View>
          <View style={styles.planChips}>
            {planOptions.map((p) => (
              <Chip
                key={p.code}
                label={p.label}
                selected={p.code === plan}
                role="radio"
                onPress={canSwitchPlan ? () => void onSelectPlan(p.code) : undefined}
                style={styles.planChip}
              />
            ))}
          </View>
          {planErrorKey ? <ErrorNotice message={t(planErrorKey)} retryLabel={t('common.retry')} /> : null}
          <Text variant="caption" muted>
            {canSwitchPlan
              ? t('billing.placeholderNote')
              : isOwner
                ? t('billing.comingSoon')
                : t('billing.manageOwnerOnly')}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/subscription')}>
            <Text variant="button" style={styles.manageLink}>{t('billing.manageCta')}</Text>
          </Pressable>
        </Card>

        <Card>
          <Text variant="heading">{t('account.exportTitle')}</Text>
          <Text variant="caption" muted>
            {t('account.exportBody')}
          </Text>
          {exportErrorKey ? (
            <ErrorNotice
              message={t(exportErrorKey)}
              retryLabel={t('common.retry')}
              onRetry={() => void onExport()}
            />
          ) : null}
          <Button
            label={t('account.exportCta')}
            variant="secondary"
            onPress={onExport}
            loading={exporting}
          />
        </Card>

        <Card style={styles.dangerCard}>
          <Text variant="heading" style={styles.dangerTitle}>
            {t('account.deleteTitle')}
          </Text>
          <Text variant="caption" muted>
            {t('account.deleteWarning')}
          </Text>
          <TextField
            label={t('account.typeEmailLabel')}
            value={confirmEmail}
            onChangeText={setConfirmEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          {deleteErrorKey ? (
            <ErrorNotice message={t(deleteErrorKey)} retryLabel={t('common.retry')} />
          ) : null}
          <Button
            label={t('account.deleteCta')}
            onPress={onDeletePressed}
            disabled={!armed}
            loading={deleting}
            style={styles.dangerButton}
          />
        </Card>

        {/* Sign out — separated from the fields above (§6.15). */}
        <Button label={t('auth.signOut')} variant="secondary" onPress={onSignOut} loading={signingOut} />
      </ScrollView>
      {sheet.element}
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    // Cap + centre so the screen does not stretch edge to edge on a monitor.
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  profileMid: { flex: 1, gap: 2 },
  avatarPress: { alignItems: 'center', gap: spacing.xs },
  changePhoto: { color: c.primary },
  pressed: { opacity: 0.7 },
  notice: { color: c.primary },
  planHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md },
  planName: { color: c.primary },
  planChips: { flexDirection: 'row', gap: spacing.sm },
  planChip: { flex: 1 },
  manageLink: { color: c.primary },
  // Cards are borderless now; the danger zone reads as a tonal container.
  dangerCard: { backgroundColor: c.dangerMuted },
  dangerTitle: { color: c.danger },
  dangerButton: { backgroundColor: c.danger },
});
