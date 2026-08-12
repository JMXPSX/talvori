/** Retail section stack (hub, retailer branches, products, prices, locations). */

import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { palette } from '@/components/theme';

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
      <Stack.Screen name="index" options={{ title: t('retail.title') }} />
      <Stack.Screen name="[retailerId]" options={{ title: t('retail.branches') }} />
      <Stack.Screen name="products" options={{ title: t('retail.products') }} />
      <Stack.Screen name="product/[id]" options={{ title: t('retail.prices') }} />
      <Stack.Screen name="locations" options={{ title: t('retail.savedLocations') }} />
    </Stack>
  );
}
