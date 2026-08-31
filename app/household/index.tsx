/**
 * Households home: list the households you belong to (RLS returns only yours).
 * Creating one now lives in the /household/new modal (opened from the header "+"
 * or the empty-state CTA); joining is the secondary link below (3c).
 */

import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing } from '@/components/theme';
import { useThemedStyles, useTheme, type Palette } from '@/components/ThemeProvider';
import { Card, CONTENT_MAX_WIDTH, EmptyState, Text } from '@/components/ui';
import { listMyHouseholds } from '@/features/household/api';
import type { HouseholdRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';

export default function HouseholdsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const { palette } = useTheme();

  const [households, setHouseholds] = useState<HouseholdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setHouseholds(await listMyHouseholds());
    } catch (err) {
      setLoadError(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={palette.brand} />
        ) : loadError ? (
          <Text style={{ color: palette.danger }}>{t(loadError)}</Text>
        ) : households.length === 0 ? (
          <EmptyState
            icon="home"
            message={t('household.empty')}
            ctaLabel={t('household.createCta')}
            onCta={() => router.push('/household/new')}
          />
        ) : (
          <View style={styles.list}>
            {households.map((h) => (
              <Card key={h.id} onPress={() => router.push(`/household/${h.id}`)}>
                <Text variant="subheading">{h.name}</Text>
                <Text variant="caption" muted>
                  {h.reporting_currency_code}
                  {h.is_cross_border ? ' · 🌍' : ''}
                </Text>
              </Card>
            ))}
          </View>
        )}

        <Link href="/household/join" style={styles.joinLink}>
          <Text variant="caption" style={{ color: palette.brand }}>
            {t('household.joinTitle')}
          </Text>
        </Link>
      </ScrollView>
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
  list: { gap: spacing.sm },
  joinLink: { marginTop: spacing.lg, alignSelf: 'center' },
});
