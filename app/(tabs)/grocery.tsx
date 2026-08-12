/** Grocery tab: household shopping lists (live) + create. */

import { getLocales } from 'expo-localization';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, Text, TextField } from '@/components/ui';
import { createList, listLists, subscribeToLists } from '@/features/grocery/api';
import { createListSchema } from '@/features/grocery/schemas';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { GroceryListRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { validate } from '@/lib/validation';

function deviceCurrency(fallback: string): string {
  try {
    return getLocales()[0]?.currencyCode ?? fallback;
  } catch {
    return fallback;
  }
}

export default function GroceryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { active } = useActiveHousehold();

  const [lists, setLists] = useState<GroceryListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      setLists(await listLists(active.id));
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [active]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Live updates while the tab is mounted.
  useEffect(() => {
    if (!active) return;
    if (!currency) setCurrency(deviceCurrency(active.reporting_currency_code));
    const unsub = subscribeToLists(active.id, () => void load());
    return unsub;
  }, [active, currency, load]);

  async function onCreate() {
    if (!active) return;
    const result = validate(createListSchema, { name, currencyCode: currency });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await createList(active.id, {
        name: result.data.name,
        currencyCode: result.data.currencyCode,
      });
      setName('');
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setSubmitting(false);
    }
  }

  const activeLists = lists.filter((l) => l.status === 'active');
  const completed = lists.filter((l) => l.status === 'completed');

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={palette.brand} />
        ) : errorKey ? (
          <Text style={{ color: palette.danger }}>{t(errorKey)}</Text>
        ) : lists.length === 0 ? (
          <Text muted>{t('grocery.empty')}</Text>
        ) : (
          <View style={styles.groups}>
            {activeLists.length > 0 && (
              <View style={styles.group}>
                <Text variant="caption" muted>{t('grocery.activeSection')}</Text>
                {activeLists.map((l) => (
                  <Pressable key={l.id} style={styles.card} onPress={() => router.push(`/grocery/${l.id}`)}>
                    <Text variant="heading">{l.name}</Text>
                    <Text variant="caption" muted>{l.currency_code}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {completed.length > 0 && (
              <View style={styles.group}>
                <Text variant="caption" muted>{t('grocery.completedSection')}</Text>
                {completed.map((l) => (
                  <Pressable key={l.id} style={styles.card} onPress={() => router.push(`/grocery/${l.id}`)}>
                    <Text variant="heading">{l.name}</Text>
                    <Text variant="caption" muted>{t('grocery.completedNote')}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.divider} />

        <Text variant="heading">{t('grocery.newListTitle')}</Text>
        <View style={styles.form}>
          <TextField
            label={t('grocery.nameLabel')}
            value={name}
            onChangeText={setName}
            autoCapitalize="sentences"
            error={fieldErrors.name ? t('errors.validation') : undefined}
          />
          <TextField
            label={t('grocery.currencyLabel')}
            value={currency}
            onChangeText={setCurrency}
            hint={t('household.currencyHint')}
            autoCapitalize="characters"
            error={fieldErrors.currencyCode ? t('errors.validation') : undefined}
          />
          <Button
            label={submitting ? t('auth.processing') : t('grocery.createCta')}
            onPress={onCreate}
            loading={submitting}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.lg, gap: spacing.md },
  groups: { gap: spacing.md },
  group: { gap: spacing.sm },
  card: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    gap: spacing.xs,
  },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
  form: { gap: spacing.sm },
});
