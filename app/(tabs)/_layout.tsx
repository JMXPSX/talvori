/**
 * Bottom-tab navigation skeleton (see 07_PRODUCT_MODULES_AND_MVP.md).
 * Initial tabs: Home, Budget, Transactions, Grocery, More. Labels are localized
 * and the bar is direction-aware. No business functionality yet.
 */

import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { palette } from '@/components/theme';

export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: palette.background },
        headerTintColor: palette.text,
        tabBarActiveTintColor: palette.brand,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarStyle: { backgroundColor: palette.background, borderTopColor: palette.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('nav.home') }} />
      <Tabs.Screen name="budget" options={{ title: t('nav.budget') }} />
      <Tabs.Screen name="transactions" options={{ title: t('nav.transactions') }} />
      <Tabs.Screen name="grocery" options={{ title: t('nav.grocery') }} />
      <Tabs.Screen name="more" options={{ title: t('nav.more') }} />
    </Tabs>
  );
}
