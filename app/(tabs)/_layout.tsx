/**
 * Adaptive primary navigation (see 07_PRODUCT_MODULES_AND_MVP.md).
 * Tabs: Home, Budget, Transactions (Activity), Grocery (Shop), More.
 *
 * Narrow viewports get the bottom tab bar. Wide ones (desktop browsers, tablets
 * in landscape) get the Talvori desktop shell: a grouped sidebar + a persistent
 * top bar, composed here around the tab content. The split is by width, not
 * platform, because the app ships as a Web-PWA — a phone browser must still get
 * the mobile layout. Direction-aware: the sidebar sits on the right in RTL.
 *
 * The sidebar surfaces destinations beyond the five tabs (Bills, Household,
 * Reports, Settings, Help) via router navigation; those open as full-screen
 * stack routes for now (persistent-shell-everywhere is a later phase).
 */

import { Feather } from '@expo/vector-icons';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { I18nManager, View, type ColorValue } from 'react-native';

import { BottomTabBar } from '@/components/ui/BottomTabBar';
import { DesktopTopBar } from '@/components/ui/DesktopTopBar';
import { SideNav, type SideNavItem, type SideNavSection } from '@/components/ui/SideNav';
import { useAuth } from '@/features/auth/AuthProvider';
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

/** Sidebar destinations, grouped per the Talvori desktop mock. `match` decides
 *  the active row from the current pathname; the row navigates to `href`. */
function useSideNavSections(): SideNavSection[] {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const { active } = useActiveHousehold();

  const householdHref = active ? `/household/${active.id}` : '/household';
  const go = (href: string) => () => router.navigate(href as never);

  const item = (
    key: string,
    label: string,
    icon: FeatherName,
    href: string,
    match: (p: string) => boolean,
  ): SideNavItem => ({ key, label, icon, active: match(pathname), onPress: go(href) });

  return [
    {
      title: t('nav.sectionPlan'),
      items: [
        item('home', t('nav.home'), 'home', '/', (p) => p === '/'),
        item('budget', t('nav.budget'), 'pie-chart', '/budget', (p) => p.startsWith('/budget')),
        item('activity', t('nav.transactions'), 'list', '/transactions', (p) => p.startsWith('/transactions')),
        item('shop', t('nav.grocery'), 'shopping-cart', '/grocery', (p) => p.startsWith('/grocery')),
      ],
    },
    {
      title: t('nav.sectionMoney'),
      items: [
        item('bills', t('more.bills'), 'file-text', '/bills', (p) => p.startsWith('/bills')),
        item('household', t('more.household'), 'users', householdHref, (p) => p.startsWith('/household')),
        item('reports', t('nav.reports'), 'bar-chart-2', '/finance/insights', (p) => p.startsWith('/finance/insights')),
      ],
    },
    {
      title: t('nav.sectionApp'),
      items: [
        item('settings', t('more.settings'), 'settings', '/settings', (p) => p.startsWith('/settings')),
        item('help', t('more.help'), 'help-circle', '/help', (p) => p.startsWith('/help')),
      ],
    },
  ];
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const isWide = useIsWideLayout();
  const router = useRouter();
  const { active } = useActiveHousehold();
  const { user } = useAuth();
  const sections = useSideNavSections();

  const displayName =
    (typeof user?.user_metadata?.display_name === 'string' && user.user_metadata.display_name) ||
    user?.email ||
    '';

  const tabs = (
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

  if (!isWide) return tabs;

  return (
    <View style={{ flex: 1, flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row' }}>
      <SideNav
        brand={t('common.appName')}
        sections={sections}
        footer={
          displayName
            ? { name: displayName, meta: active?.name, onPress: () => router.navigate('/account' as never) }
            : undefined
        }
      />
      <View style={{ flex: 1 }}>
        <DesktopTopBar />
        {tabs}
      </View>
    </View>
  );
}
