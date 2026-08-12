/** Manage categories (income/expense). Categories are optional labels on entries. */

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, Text, TextField } from '@/components/ui';
import { createCategory, listCategories } from '@/features/finance/api';
import { createCategorySchema } from '@/features/finance/schemas';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { CategoryKind, CategoryRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { validate } from '@/lib/validation';

export default function CategoriesScreen() {
  const { t } = useTranslation();
  const { active } = useActiveHousehold();

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      setCategories(await listCategories(active.id));
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

  async function onCreate() {
    if (!active) return;
    setFormError(null);
    const result = validate(createCategorySchema, { name, kind });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await createCategory(active.id, result.data);
      setName('');
      await load();
    } catch (err) {
      setFormError(toAppError(err).messageKey);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={palette.brand} />
        ) : errorKey ? (
          <Text style={{ color: palette.danger }}>{t(errorKey)}</Text>
        ) : categories.length === 0 ? (
          <Text muted>{t('finance.categories.empty')}</Text>
        ) : (
          <View style={styles.list}>
            {categories.map((c) => (
              <View key={c.id} style={styles.card}>
                <Text>{c.name}</Text>
                <Text variant="caption" muted>
                  {c.kind === 'income' ? t('finance.categories.income') : t('finance.categories.expense')}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.divider} />

        <Text variant="heading">{t('finance.categories.addTitle')}</Text>
        <View style={styles.form}>
          <TextField
            label={t('finance.categories.nameLabel')}
            value={name}
            onChangeText={setName}
            autoCapitalize="sentences"
            error={fieldErrors.name ? t('errors.validation') : undefined}
          />
          <Text variant="caption" muted>
            {t('finance.categories.kindLabel')}
          </Text>
          <View style={styles.chips}>
            {(['expense', 'income'] as CategoryKind[]).map((k) => {
              const activeChip = k === kind;
              return (
                <Pressable
                  key={k}
                  onPress={() => setKind(k)}
                  style={[styles.chip, activeChip ? styles.chipActive : null]}
                >
                  <Text variant="caption" style={{ color: activeChip ? palette.white : palette.text }}>
                    {k === 'income' ? t('finance.categories.income') : t('finance.categories.expense')}
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
            label={submitting ? t('auth.processing') : t('finance.categories.createCta')}
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
  list: { gap: spacing.sm },
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
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.brand,
  },
  chipActive: { backgroundColor: palette.brand },
});
