/**
 * Onboarding (§6.3) — the two-step first-run flow for a user with no household.
 *   Step 1  Set up your household  — name + reporting currency → creates it.
 *   Step 2  Invite your household  — shows the standing join code (copy / share),
 *           a "created" confirmation, then into the app.
 *
 * There is NO cross-border step here (§6.3): that flag lives in Household settings.
 * Creating the household happens at Continue so step 2 can show its real code; both
 * "Go to my dashboard" and "Skip for now" land on Home with the household active.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import { radius, spacing } from '@/components/theme';
import { useThemedStyles, useTheme, type Palette } from '@/components/ThemeProvider';
import {
  BrandLockup,
  Button,
  CurrencyField,
  FORM_MAX_WIDTH,
  Text,
  TextField,
} from '@/components/ui';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { createHousehold } from '@/features/household/api';
import { useRouter } from 'expo-router';
import type { HouseholdRow } from '@/lib/database.types';
import { defaultCurrencyCode } from '@/lib/defaults';
import { toAppError } from '@/lib/errors';

/** Two progress dots; filled = done/current (§6.3). */
function StepDots({ step }: { step: 1 | 2 }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.dots}>
      <View style={[styles.dot, styles.dotOn]} />
      <View style={[styles.dot, step === 2 ? styles.dotOn : styles.dotOff]} />
    </View>
  );
}

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const { palette } = useTheme();
  const { refresh, setActiveId } = useActiveHousehold();

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(defaultCurrencyCode());
  const [created, setCreated] = useState<HouseholdRow | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  async function onContinue() {
    setFormError(null);
    if (!name.trim()) {
      setNameError('onboarding.nameRequired');
      return;
    }
    setNameError(null);
    setSubmitting(true);
    try {
      const h = await createHousehold({
        name: name.trim(),
        reportingCurrencyCode: currency,
        isCrossBorder: false,
      });
      await refresh();
      setActiveId(h.id);
      setCreated(h);
      setStep(2);
    } catch (err) {
      setFormError(toAppError(err).messageKey);
    } finally {
      setSubmitting(false);
    }
  }

  async function onCopy() {
    if (!created) return;
    await Clipboard.setStringAsync(created.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function onShare() {
    if (!created) return;
    await Share.share({ message: created.code });
  }

  function finish() {
    router.replace('/');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <BrandLockup markSize={34} />
        <StepDots step={step} />
        <Text variant="caption" muted>
          {t('onboarding.stepLabel', { current: step, total: 2 })}
        </Text>

        {step === 1 ? (
          <>
            <Text variant="title">{t('onboarding.step1Title')}</Text>
            <View style={styles.form}>
              <TextField
                label={t('household.nameLabel')}
                value={name}
                onChangeText={setName}
                placeholder={t('onboarding.householdNamePlaceholder')}
                autoCapitalize="words"
                error={nameError ? t(nameError) : undefined}
              />
              <CurrencyField
                label={t('household.currencyLabel')}
                value={currency}
                onChange={setCurrency}
                suggested={[defaultCurrencyCode()].filter(Boolean)}
              />
              {formError ? (
                <Text variant="caption" style={{ color: palette.danger }}>
                  {t(formError)}
                </Text>
              ) : null}
              <Button
                label={submitting ? t('auth.processing') : t('common.continue')}
                onPress={onContinue}
                loading={submitting}
              />
            </View>
          </>
        ) : (
          <>
            <Text variant="title">{t('onboarding.step2Title')}</Text>
            <Text muted>{t('onboarding.step2Sub')}</Text>

            {/* Invite card — INVITE CODE label, the code, Copy / Share. */}
            <View style={styles.inviteCard}>
              <Text variant="eyebrow" muted style={styles.inviteLabel}>
                {t('onboarding.inviteCodeLabel')}
              </Text>
              <Text style={styles.code}>{created?.code}</Text>
              <View style={styles.inviteActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={onCopy}
                  style={[styles.pillBtn, styles.pillTint]}
                >
                  <Text variant="button" style={styles.pillTintText}>
                    {copied ? t('onboarding.copied') : t('onboarding.copyCode')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={onShare}
                  style={[styles.pillBtn, styles.pillOutline]}
                >
                  <Text variant="button">{t('onboarding.share')}</Text>
                </Pressable>
              </View>
            </View>

            {/* Confirmation strip. */}
            <View style={styles.confirm}>
              <Text variant="caption" style={styles.confirmText}>
                {t('onboarding.createdConfirm', {
                  name: created?.name ?? '',
                  currency: created?.reporting_currency_code ?? '',
                })}
              </Text>
            </View>

            <View style={styles.form}>
              <Button label={t('onboarding.goToDashboard')} onPress={finish} />
              <Pressable accessibilityRole="button" onPress={finish} style={styles.skip}>
                <Text variant="button" style={{ color: palette.textSecondary }}>
                  {t('onboarding.skipForNow')}
                </Text>
              </Pressable>
              <Text variant="caption" muted style={styles.helper}>
                {t('onboarding.crossBorderHelper')}
              </Text>
            </View>
          </>
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
    maxWidth: FORM_MAX_WIDTH,
    alignSelf: 'center',
  },
  dots: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  dot: { flex: 1, height: 4, borderRadius: radius.pill },
  dotOn: { backgroundColor: c.primary },
  dotOff: { backgroundColor: c.divider },
  form: { gap: spacing.md, marginTop: spacing.sm },
  inviteCard: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.04)',
  },
  inviteLabel: { textAlign: 'center' },
  code: {
    fontSize: 28,
    fontWeight: '800',
    color: c.primary,
    letterSpacing: 4,
  },
  inviteActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  pillBtn: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillTint: { backgroundColor: c.primaryTint },
  pillTintText: { color: c.primary },
  pillOutline: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  confirm: {
    backgroundColor: c.successSurface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  confirmText: { color: c.positiveStrong },
  skip: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  helper: { textAlign: 'center', lineHeight: 16 },
});
