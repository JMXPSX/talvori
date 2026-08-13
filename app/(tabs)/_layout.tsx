/**
 * Bottom-tab navigation skeleton (see 07_PRODUCT_MODULES_AND_MVP.md).
 * Initial tabs: Home, Budget, Transactions, Grocery, More. Labels are localized
 * and the bar is direction-aware. No business functionality yet.
 */

import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';

import { palette } from '@/components/theme';

type FeatherName = keyof typeof Feather.glyphMap;
const tabIcon = (name: FeatherName) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Feather name={name} color={color as string} size={size} />;
  };

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
      <Tabs.Screen name="index" options={{ title: t('nav.home'), tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="budget" options={{ title: t('nav.budget'), tabBarIcon: tabIcon('pie-chart') }} />
      <Tabs.Screen name="transactions" options={{ title: t('nav.transactions'), tabBarIcon: tabIcon('list') }} />
      <Tabs.Screen name="grocery" options={{ title: t('nav.grocery'), tabBarIcon: tabIcon('shopping-cart') }} />
      <Tabs.Screen name="more" options={{ title: t('nav.more'), tabBarIcon: tabIcon('more-horizontal') }} />
    </Tabs>
  );
}
