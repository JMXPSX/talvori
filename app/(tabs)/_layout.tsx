/**
 * Adaptive primary navigation (see 07_PRODUCT_MODULES_AND_MVP.md).
 * Tabs: Home, Budget, Transactions (Activity), Grocery (Shop), More.
 *
 * Narrow viewports get the bottom tab bar. On wide viewports the persistent
 * desktop shell (sidebar + top bar) is drawn once by the root navigator around
 * the WHOLE stack (see components/ui/DesktopShell), so here we only hide the
 * bottom bar and let the tab content fill the shell's content area.
 */

import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { type ColorValue } from 'react-native';

import { BottomTabBar } from '@/components/ui/BottomTabBar';
import { type SideNavItem } from '@/components/ui/SideNav';
import { useNotifications } from '@/features/notifications/NotificationsProvider';
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
  const { count } = useNotifications();

  return (
    <Tabs
      tabBar={
        isWide
          ? () => null
          : ({ state, descriptors, navigation }) => {
              const items: SideNavItem[] = state.routes.map((route, index) => {
                const { options } = descriptors[route.key] ?? {};
                const isActive = state.index === index;
                return {
                  key: route.key,
                  label: options?.title ?? route.name,
                  icon: TAB_ICONS[route.name] ?? 'circle',
                  active: isActive,
                  badge: route.name === 'more' ? count : undefined,
                  onPress: () => {
                    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                    if (!isActive && !event.defaultPrevented) navigation.navigate(route.name, route.params);
                  },
                };
              });
              return <BottomTabBar items={items} />;
            }
      }
      screenOptions={{ headerShown: false, tabBarPosition: 'bottom' }}
    >
      <Tabs.Screen name="index" options={{ title: t('nav.home'), tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="budget" options={{ title: t('nav.budget'), tabBarIcon: tabIcon('pie-chart') }} />
      <Tabs.Screen name="transactions" options={{ title: t('nav.transactions'), tabBarIcon: tabIcon('list') }} />
      <Tabs.Screen name="grocery" options={{ title: t('nav.grocery'), tabBarIcon: tabIcon('shopping-cart') }} />
      <Tabs.Screen name="more" options={{ title: t('nav.more'), tabBarIcon: tabIcon('more-horizontal') }} />
    </Tabs>
  );
}
