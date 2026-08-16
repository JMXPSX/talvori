/** Products list + add product; tap a product to view its prices across branches. */

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { elevation, palette, radius, spacing } from '@/components/theme';
import { Button, CONTENT_MAX_WIDTH, Text, TextField } from '@/components/ui';
import { createProduct, listProducts } from '@/features/retail/api';
import { createProductSchema } from '@/features/retail/schemas';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { ProductRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { validate } from '@/lib/validation';

export default function ProductsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { active } = useActiveHousehold();

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [sizeValue, setSizeValue] = useState('');
  const [sizeUnit, setSizeUnit] = useState('');
  const [packCount, setPackCount] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      setProducts(await listProducts(active.id));
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

  async function onAdd() {
    if (!active) return;
    const result = validate(createProductSchema, {
      name, brand, sizeValue, sizeUnit, packCount,
    });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await createProduct(active.id, result.data);
      setName(''); setBrand(''); setSizeValue(''); setSizeUnit(''); setPackCount('');
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {errorKey ? <Text style={{ color: palette.danger }}>{t(errorKey)}</Text> : null}
        {loading ? (
          <ActivityIndicator color={palette.brand} />
        ) : products.length === 0 ? (
          <Text muted>{t('retail.noProducts')}</Text>
        ) : (
          <View style={styles.list}>
            {products.map((p) => (
              <Pressable key={p.id} style={styles.card} onPress={() => router.push(`/retail/product/${p.id}`)}>
                <Text variant="heading">{p.name}</Text>
                <Text variant="caption" muted>
                  {[p.brand, p.size_value ? `${p.size_value}${p.size_unit ?? ''}` : null,
                    p.pack_count > 1 ? `x${p.pack_count}` : null].filter(Boolean).join(' · ')}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.divider} />
        <Text variant="heading">{t('retail.addProduct')}</Text>
        <View style={styles.form}>
          <TextField label={t('retail.productName')} value={name} onChangeText={setName}
            autoCapitalize="sentences" error={fieldErrors.name ? t('errors.validation') : undefined} />
          <TextField label={t('retail.brand')} value={brand} onChangeText={setBrand} autoCapitalize="sentences" />
          <TextField label={t('retail.size')} value={sizeValue} onChangeText={setSizeValue} keyboardType="numeric" />
          <TextField label={t('retail.unit')} value={sizeUnit} onChangeText={setSizeUnit} />
          <TextField label={t('retail.packCount')} value={packCount} onChangeText={setPackCount} keyboardType="numeric" />
          <Button label={submitting ? t('auth.processing') : t('retail.addProduct')} onPress={onAdd} loading={submitting} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
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
    boxShadow: elevation.tile, gap: spacing.xs,
  },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
  form: { gap: spacing.sm },
});
