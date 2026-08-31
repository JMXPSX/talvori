/** Bills & Subscriptions (§6.10) — honest placeholder. The full feature (recurring
 *  income/expenses, frequencies, due dates, pause/resume) needs a `bills` table +
 *  API that isn't built yet, so this shows the zero-state hero and says so plainly
 *  rather than faking an add flow (README: "No fake capability"). */

import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { elevation, radius, spacing } from '@/components/theme';
import { useThemedStyles, type Palette } from '@/components/ThemeProvider';
import { Card, FORM_MAX_WIDTH, Text } from '@/components/ui';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { formatAmount } from '@/lib/format';

export default function BillsScreen() {
  const { t } = useTranslation();
  const { active } = useActiveHousehold();
  const styles = useThemedStyles(makeStyles);
  const currency = active?.reporting_currency_code ?? 'USD';

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: t('bills.title') }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text variant="title">{t('bills.title')}</Text>
          <Text muted>{t('bills.sub')}</Text>
        </View>

        {/* Zero-state hero (§7): zero-formatted amount + "0 active bills". */}
        <View style={styles.hero}>
          <Text variant="eyebrow" style={styles.heroLabel}>{t('bills.title')}</Text>
          <Text variant="title" style={styles.heroAmount}>{formatAmount(0, currency)}</Text>
          <Text variant="caption" style={styles.heroSub}>{t('bills.empty')}</Text>
        </View>

        <Card>
          <Text variant="caption" muted>{t('bills.notWired')}</Text>
        </Card>
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
  hero: {
    backgroundColor: c.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.xs,
    boxShadow: elevation.raised,
  },
  heroLabel: { color: c.white, opacity: 0.85 },
  heroAmount: { color: c.white, fontSize: 34 },
  heroSub: { color: c.white, opacity: 0.9 },
});
