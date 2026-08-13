/** Subscription: current plan + premium capabilities. Owner sees a manual
 *  plan toggle (pre-billing placeholder; 6b replaces it with real purchases). */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, Text } from '@/components/ui';
import { setHouseholdPlan } from '@/features/billing/api';
import { PLAN_CAPABILITIES } from '@/features/billing/plans';
import type { Capability } from '@/features/billing/plans';
import { usePlan } from '@/features/billing/EntitlementsProvider';
import { useAuth } from '@/features/auth/AuthProvider';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { toAppError } from '@/lib/errors';

const CAP_LABEL: Record<Capability, string> = {
  multi_currency_dashboard: 'billing.capMultiCurrency',
  retail_comparison: 'billing.capRetailComparison',
  coupons: 'billing.capCoupons',
  multiple_households: 'billing.capMultipleHouseholds',
  unlimited_goals: 'billing.capUnlimitedGoals',
};

export default function SubscriptionScreen() {
  const { t } = useTranslation();
  const { plan, refresh } = usePlan();
  const { active } = useActiveHousehold();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

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
        {errorKey ? <Text style={{ color: palette.danger }}>{t(errorKey)}</Text> : null}

        <View style={styles.card}>
          <Text variant="caption" muted>{t('billing.currentPlan')}</Text>
          <Text variant="heading">
            {plan === 'premium' ? t('billing.planPremium') : t('billing.planFree')}
          </Text>
        </View>

        <Text variant="heading">{t('billing.capabilities')}</Text>
        <View style={styles.list}>
          {PLAN_CAPABILITIES.premium.map((c) => (
            <Text key={c} muted>• {t(CAP_LABEL[c])}</Text>
          ))}
        </View>

        <View style={styles.divider} />

        {isOwner ? (
          <View style={styles.list}>
            <Text variant="caption" muted>{t('billing.placeholderNote')}</Text>
            {plan === 'premium' ? (
              <Button label={t('billing.switchToFree')} variant="secondary" onPress={() => switchTo('free')} loading={busy} />
            ) : (
              <Button label={t('billing.switchToPremium')} variant="accent" onPress={() => switchTo('premium')} loading={busy} />
            )}
          </View>
        ) : (
          <Text muted>{t('billing.manageOwnerOnly')}</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.lg, gap: spacing.md },
  list: { gap: spacing.sm },
  card: {
    padding: spacing.md, borderWidth: 1, borderColor: palette.border,
    borderRadius: radius.md, backgroundColor: palette.surface, gap: spacing.xs,
  },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
});
