/** Retail section stack (hub, retailer branches, products, prices, locations). */

import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { palette, spacing } from '@/components/theme';

/** Header "+" that opens the create-retailer modal (3c). */
function HeaderAddRetailer() {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('retail.addRetailer')}
      hitSlop={12}
      onPress={() => router.push('/retail/new')}
      style={{ paddingHorizontal: spacing.md }}
    >
      <Feather name="plus" size={22} color={palette.brand} />
    </Pressable>
  );
}

export default function RetailLayout() {
  const { t } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.background },
        headerTintColor: palette.text,
        contentStyle: { backgroundColor: palette.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: t('retail.title'), headerRight: () => <HeaderAddRetailer /> }}
      />
      <Stack.Screen
        name="new"
        options={{ title: t('retail.addRetailer'), presentation: 'modal' }}
      />
      <Stack.Screen name="[retailerId]" options={{ title: t('retail.branches') }} />
      <Stack.Screen name="products" options={{ title: t('retail.products') }} />
      <Stack.Screen name="product/[id]" options={{ title: t('retail.prices') }} />
      <Stack.Screen name="locations" options={{ title: t('retail.savedLocations') }} />
      <Stack.Screen name="coupons" options={{ title: t('coupons.title') }} />
    </Stack>
  );
}
