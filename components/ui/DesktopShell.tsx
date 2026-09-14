/**
 * Persistent desktop shell (wide layout only). The grouped sidebar + top bar,
 * wrapped around the WHOLE app stack by the root navigator — so destinations
 * beyond the five tabs (Bills, Household, Reports, Settings, Help, Subscription,
 * Account, Notifications) keep the same chrome instead of opening as bare
 * full-screen routes. The tabs layout no longer draws its own sidebar.
 *
 * Direction-aware: the sidebar sits on the right in RTL. Only mounted on wide
 * viewports for authenticated in-app routes (the root navigator decides).
 */

import { Feather } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { I18nManager, View } from 'react-native';

import { DesktopTopBar } from '@/components/ui/DesktopTopBar';
import { SideNav, type SideNavItem, type SideNavSection } from '@/components/ui/SideNav';
import { useAuth } from '@/features/auth/AuthProvider';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';

type FeatherName = keyof typeof Feather.glyphMap;

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
        item('reports', t('nav.reports'), 'bar-chart-2', '/finance/reports', (p) => p.startsWith('/finance/reports') || p.startsWith('/finance/insights')),
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

/** Page title for the top bar, for the leaf routes whose native header is hidden
 *  on wide. Nested stacks (finance/*, household/*) keep their own header, so we
 *  return undefined for them to avoid a double title. */
function usePageTitle(): string | undefined {
  const { t } = useTranslation();
  const p = usePathname();
  if (p === '/') return t('nav.home');
  if (p.startsWith('/budget')) return t('nav.budget');
  if (p.startsWith('/transactions')) return t('nav.transactions');
  if (p.startsWith('/grocery')) return t('nav.grocery');
  if (p.startsWith('/bills')) return t('more.bills');
  if (p.startsWith('/settings')) return t('more.settings');
  if (p.startsWith('/help')) return t('more.help');
  if (p.startsWith('/subscription')) return t('billing.title');
  if (p.startsWith('/account')) return t('account.title');
  if (p.startsWith('/notifications')) return t('notifications.title');
  return undefined;
}

export function DesktopShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const sections = useSideNavSections();
  const title = usePageTitle();
  const { user } = useAuth();
  const { active } = useActiveHousehold();

  const displayName =
    (typeof user?.user_metadata?.display_name === 'string' && user.user_metadata.display_name) ||
    user?.email ||
    '';

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
        <DesktopTopBar title={title} />
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    </View>
  );
}
