/** Subscription (3e redesign): an honest free card + a branded premium card with
 *  job-framed benefits and regional-billing footer. The owner's manual toggle is
 *  a DEV-ONLY affordance (6b replaces it with real in-app purchases). */

import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { elevation, radius, spacing } from '@/components/theme';
import { useThemedStyles, useTheme, type Palette } from '@/components/ThemeProvider';
import { Button, Card, FORM_MAX_WIDTH, Text } from '@/components/ui';
import { setHouseholdPlan } from '@/features/billing/api';
import { usePlan } from '@/features/billing/EntitlementsProvider';
import { useAuth } from '@/features/auth/AuthProvider';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { toAppError } from '@/lib/errors';

/** Premium value, framed as jobs the household gets done (not feature names). */
const JOBS = ['billing.jobOneTotal', 'billing.jobCompare', 'billing.jobCoupons', 'billing.jobInsights'];

export default function SubscriptionScreen() {
  const { t } = useTranslation();
  const { plan, refresh } = usePlan();
  const { active } = useActiveHousehold();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const styles = useThemedStyles(makeStyles);
  const { palette } = useTheme();

  const isOwner = Boolean(active && user && active.created_by === user.id);

  async function switchTo(next: 'free' | 'premium') {
    if (!active) return;
    setBusy(true);
    setErrorKey(null);
    try {
      await setHouseholdPlan(active.id, next);
      refresh();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="title">{t('billing.title')}</Text>
        {errorKey ? <Text style={{ color: palette.danger }}>{t(errorKey)}</Text> : null}

        <Card>
          <View style={styles.cardHead}>
            <Text variant="subheading">{t('billing.planFree')}</Text>
            {plan === 'free' ? (
              <View style={styles.pill}>
                <Text variant="caption" muted>{t('billing.currentPill')}</Text>
              </View>
            ) : null}
          </View>
          <Text muted>{t('billing.freeSentence')}</Text>
        </Card>

        <Card style={styles.premiumCard}>
          <View style={styles.cardHead}>
            <Text variant="subheading" style={styles.white}>{t('billing.planPremium')}</Text>
            {plan === 'premium' ? (
              <View style={styles.pillAccent}>
                <Text variant="caption" style={styles.pillAccentText}>{t('billing.currentPill')}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.whiteMuted}>{t('billing.premiumTagline')}</Text>
          <View style={styles.jobs}>
            {JOBS.map((j) => (
              <View key={j} style={styles.jobRow}>
                <View style={styles.jobCheck}>
                  <Feather name="check" size={14} color={palette.accent} />
                </View>
                <Text style={styles.white}>{t(j)}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Text variant="caption" muted>{t('billing.billingFooter')}</Text>

        {/* DEV-ONLY manual toggle — hidden in production so it can't be a
            free-premium hole. Real upgrades arrive with billing (6b). */}
        {isOwner && __DEV__ ? (
          <View style={styles.list}>
            <Text variant="caption" muted>{t('billing.placeholderNote')}</Text>
            {plan === 'premium' ? (
              <Button label={t('billing.switchToFree')} variant="secondary" onPress={() => switchTo('free')} loading={busy} />
            ) : (
              <Button label={t('billing.tryPremium')} onPress={() => switchTo('premium')} loading={busy} />
            )}
          </View>
        ) : isOwner ? (
          <Text muted>{t('billing.comingSoon')}</Text>
        ) : (
          <Text muted>{t('billing.manageOwnerOnly')}</Text>
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
  list: { gap: spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  pill: {
    backgroundColor: c.field,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  pillAccent: {
    backgroundColor: c.accentMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  pillAccentText: { color: c.accent },
  premiumCard: { backgroundColor: c.brand, boxShadow: elevation.raised },
  white: { color: c.white },
  whiteMuted: { color: c.white, opacity: 0.85 },
  jobs: { gap: spacing.sm, marginTop: spacing.xs },
  jobRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  jobCheck: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: c.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
