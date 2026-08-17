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
import { Tabs, usePathname, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { I18nManager, type ColorValue } from 'react-native';

import { BottomTabBar } from '@/components/ui/BottomTabBar';
import { SideNav, type SideNavItem } from '@/components/ui/SideNav';
import { useAuth } from '@/features/auth/AuthProvider';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { useIsWideLayout } from '@/lib/breakpoints';

type FeatherName = keyof typeof Feather.glyphMap;

/** Up-to-two-letter mark from a name or email, for the sidebar tiles. */
function initials(source: string | null | undefined): string {
  const s = (source ?? '').trim();
  if (!s) return '—';
  const parts = s.split(/[\s@._-]+/).filter(Boolean);
  const letters = parts
    .slice(0, 2)
    .map((p) => p[0])
    .join('');
  return (letters || s.slice(0, 2)).toUpperCase();
}

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
  const router = useRouter();
  const pathname = usePathname();
  const isWide = useIsWideLayout();
  const { active } = useActiveHousehold();
  const { user } = useAuth();
  const email = user?.email ?? undefined;
  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ?? email?.split('@')[0] ?? '';

  return (
    <Tabs
      tabBar={({ state, descriptors, navigation }) => {
        const tabByName: Record<string, SideNavItem> = {};
        state.routes.forEach((route, index) => {
          const { options } = descriptors[route.key] ?? {};
          const isActive = state.index === index;
          tabByName[route.name] = {
            key: route.key,
            label: options?.title ?? route.name,
            icon: TAB_ICONS[route.name] ?? 'circle',
            active: isActive,
            onPress: () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isActive && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            },
          };
        });

        // Mobile bottom tabs: the tab routes in navigator order (stays ≤5).
        const tabItems = state.routes
          .map((route) => tabByName[route.name])
          .filter((it): it is SideNavItem => Boolean(it));

        if (!isWide) return <BottomTabBar items={tabItems} />;

        // Wide sidebar mirrors the Modernist redesign's 7 rows: the four primary
        // tabs (Transactions ahead of Budget), then links into the retail and
        // household stacks, then More. Those two stacks live outside the tab
        // group, so the sidebar does not persist once you enter them.
        const sidebarItems = [
          tabByName.index,
          tabByName.transactions,
          tabByName.budget,
          tabByName.grocery,
          {
            key: 'retail',
            label: t('retail.title'),
            icon: 'tag' as FeatherName,
            active: pathname.startsWith('/retail'),
            onPress: () => router.push('/retail'),
          },
          {
            key: 'household',
            label: t('household.title'),
            icon: 'users' as FeatherName,
            active: pathname.startsWith('/household'),
            onPress: () => router.push('/household'),
          },
          tabByName.more,
        ].filter((it): it is SideNavItem => Boolean(it));

        return (
          <SideNav
            brand={t('common.appName')}
            household={
              active
                ? {
                    name: active.name,
                    meta: active.reporting_currency_code,
                    mark: initials(active.name),
                    onPress: () => router.push('/household'),
                  }
                : undefined
            }
            user={
              user
                ? { name: displayName || '—', meta: email, mark: initials(displayName || email) }
                : undefined
            }
            items={sidebarItems}
          />
        );
      }}
      screenOptions={{
        // Tabs render their own in-screen titles; the native header would double them.
        headerShown: false,
        // 'left'/'right' lays the navigator out as a row, so the custom bar above
        // renders as a sidebar rather than a bar under the content.
        tabBarPosition: isWide ? (I18nManager.isRTL ? 'right' : 'left') : 'bottom',
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
