/**
 * Adaptive primary navigation (see 07_PRODUCT_MODULES_AND_MVP.md).
 * Tabs: Home, Budget, Transactions, Grocery, More.
 *
 * Narrow viewports get the bottom tab bar; wide ones (desktop browsers, tablets
 * in landscape) get the sidebar from the ibilly web mock. The split is by width,
 * not platform, because the app ships as a Web-PWA — a phone browser must still
 * get the mobile layout. Direction-aware: the sidebar sits on the right in RTL.
 */

import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { I18nManager, type ColorValue } from 'react-native';

import { palette } from '@/components/theme';
import { SideNav, type SideNavItem } from '@/components/ui/SideNav';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { useIsWideLayout } from '@/lib/breakpoints';

type FeatherName = keyof typeof Feather.glyphMap;

const TAB_ICONS: Record<string, FeatherName> = {
  index: 'home',
  budget: 'pie-chart',
  transactions: 'list',
  grocery: 'shopping-cart',
  more: 'more-horizontal',
};

const tabIcon = (name: FeatherName) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Feather name={name} color={color as string} size={size} />;
  };

export default function TabsLayout() {
  const { t } = useTranslation();
  const isWide = useIsWideLayout();
  const { active } = useActiveHousehold();

  return (
    <Tabs
      tabBar={
        isWide
          ? ({ state, descriptors, navigation }) => {
              const items: SideNavItem[] = state.routes.map((route, index) => {
                const { options } = descriptors[route.key] ?? {};
                const active = state.index === index;
                return {
                  key: route.key,
                  label: options?.title ?? route.name,
                  icon: TAB_ICONS[route.name] ?? 'circle',
                  active,
                  onPress: () => {
                    const event = navigation.emit({
                      type: 'tabPress',
                      target: route.key,
                      canPreventDefault: true,
                    });
                    if (!active && !event.defaultPrevented) {
                      navigation.navigate(route.name, route.params);
                    }
                  },
                };
              });
              return (
                <SideNav
                  brand={t('common.appName')}
                  title={active?.name}
                  subtitle={active?.reporting_currency_code}
                  items={items}
                />
              );
            }
          : undefined
      }
      screenOptions={{
        // Tabs render their own in-screen titles; the native header would double them.
        headerShown: false,
        // 'left'/'right' lays the navigator out as a row, so the custom bar above
        // renders as a sidebar rather than a bar under the content.
        tabBarPosition: isWide ? (I18nManager.isRTL ? 'right' : 'left') : 'bottom',
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
