/** Pick the catalog product a grocery item refers to (or unlink). */

import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { elevation, palette, radius, spacing } from '@/components/theme';
import { Button, CONTENT_MAX_WIDTH, Text } from '@/components/ui';
import { setGroceryItemProduct } from '@/features/grocery/api';
import { listProducts } from '@/features/retail/api';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { ProductRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';

export default function LinkProductScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const id = String(itemId);
  const { active } = useActiveHousehold();

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
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

  async function pick(productId: string | null) {
    try {
      await setGroceryItemProduct(id, productId);
      router.back();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {errorKey ? <Text style={{ color: palette.danger }}>{t(errorKey)}</Text> : null}
        <Button label={t('grocery.unlink')} variant="secondary" onPress={() => pick(null)} />
        {loading ? (
          <ActivityIndicator color={palette.brand} />
        ) : products.length === 0 ? (
          <Text muted>{t('retail.noProducts')}</Text>
        ) : (
          <View style={styles.list}>
            {products.map((p) => (
              <Pressable key={p.id} style={styles.card} onPress={() => pick(p.id)}>
                <Text variant="heading">{p.name}</Text>
                <Text variant="caption" muted>
                  {[p.brand, p.size_value ? `${p.size_value}${p.size_unit ?? ''}` : null].filter(Boolean).join(' · ')}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
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
});
