/** More hub (§6.9) — profile summary card + two grouped sections (Money &
 *  Household, App & Account) with exactly six destinations, and a privacy footer.
 *  The avatar (top-right) and the profile card are the two ways into Profile;
 *  there is deliberately no Profile row. More stays the active tab on all children. */

import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, spacing } from '@/components/theme';
import { useThemedStyles, useTheme, type Palette } from '@/components/ThemeProvider';
import { Avatar, CONTENT_MAX_WIDTH, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePlan } from '@/features/billing/EntitlementsProvider';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';

type FeatherName = keyof typeof Feather.glyphMap;
interface HubItem { icon: FeatherName; label: string; sub: string; href: string }

export default function MoreScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const { plan } = usePlan();
  const { active } = useActiveHousehold();
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const email = user?.email ?? '';
  const displayName =
    (typeof user?.user_metadata?.display_name === 'string' && user.user_metadata.display_name) ||
    email.split('@')[0] ||
    '';
  const planLabel = t(plan === 'premium' ? 'more.planPremium' : 'more.planFree');

  const money: HubItem[] = [
    { icon: 'file-text', label: t('more.bills'), sub: t('more.billsSub'), href: '/bills' },
    { icon: 'users', label: t('more.household'), sub: t('more.householdSub'), href: active ? `/household/${active.id}` : '/household' },
    { icon: 'bar-chart-2', label: t('more.reports'), sub: t('more.reportsSub'), href: '/finance/reports' },
  ];
  const app: HubItem[] = [
    { icon: 'settings', label: t('more.settings'), sub: t('more.settingsSub'), href: '/settings' },
    { icon: 'help-circle', label: t('more.help'), sub: t('more.helpSub'), href: '/help' },
  ];

  function renderGroup(items: HubItem[]) {
    return (
      <View style={styles.group}>
        {items.map((it, i) => (
          <Pressable
            key={it.href}
            accessibilityRole="button"
            accessibilityLabel={it.label}
            onPress={() => router.push(it.href as never)}
            style={({ pressed }) => [styles.row, i > 0 ? styles.rowDivider : null, pressed ? styles.pressed : null]}
          >
            <View style={styles.iconTile}>
              <Feather name={it.icon} size={18} color={palette.primary} />
            </View>
            <View style={styles.rowMid}>
              <Text variant="button">{it.label}</Text>
              <Text variant="caption" muted>{it.sub}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={palette.textTertiary} />
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header — title + sub + avatar (avatar → Profile). */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text variant="title">{t('screens.moreTitle')}</Text>
            <Text variant="caption" muted>{t('more.sub')}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={displayName} onPress={() => router.push('/account')}>
            <Avatar name={displayName || email} size={42} variant="self" />
          </Pressable>
        </View>

        {/* Profile summary card → Profile. */}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/account')}
          style={({ pressed }) => [styles.profileCard, pressed ? styles.pressed : null]}
        >
          <Avatar name={displayName || email} size={40} />
          <View style={styles.rowMid}>
            <Text variant="button">{displayName}</Text>
            <Text variant="caption" muted>{t('more.profileMeta', { household: active?.name ?? '', plan: planLabel })}</Text>
          </View>
          <Feather name="chevron-right" size={20} color={palette.textTertiary} />
        </Pressable>

        <Text variant="eyebrow" muted style={styles.sectionLabel}>{t('more.moneySection')}</Text>
        {renderGroup(money)}

        <Text variant="eyebrow" muted style={styles.sectionLabel}>{t('more.appSection')}</Text>
        {renderGroup(app)}

        <Text variant="caption" muted style={styles.footer}>{t('more.footer')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headerText: { flex: 1, gap: 2 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  sectionLabel: { marginTop: spacing.sm },
  group: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.04)',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 60, paddingVertical: spacing.sm },
  rowDivider: { borderTopWidth: 1, borderTopColor: c.divider },
  rowMid: { flex: 1, gap: 2 },
  iconTile: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: c.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  footer: { textAlign: 'center', marginTop: spacing.md },
});
