/** Settings (§6.13) — currency/region + language display, appearance, notification
 *  toggles, and security & privacy. Passcode/export/delete are honest: the copy
 *  admits what isn't wired, and Delete account routes to the account screen where
 *  the real deletion lives.
 *
 *  Desktop web: a sticky left in-page nav (General / Notifications / Security)
 *  beside a right column of section cards; the nav taps scroll the right column to
 *  each section. On narrow the nav is hidden and the sections simply stack. */

import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, spacing } from '@/components/theme';
import { useThemedStyles, useTheme, type Palette, type ThemeScheme } from '@/components/ThemeProvider';
import {
  BentoPage,
  BentoRow,
  Button,
  Card,
  DestructiveAction,
  Segmented,
  Text,
  Toggle,
  useToast,
} from '@/components/ui';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { useIsWideLayout } from '@/lib/breakpoints';

type FeatherName = keyof typeof Feather.glyphMap;
interface NotifKey { key: string; label: string; sub: string; def: boolean }
type SectionId = 'general' | 'notifications' | 'security';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { active } = useActiveHousehold();
  const { scheme, setScheme, palette } = useTheme();
  const isWide = useIsWideLayout();
  const styles = useThemedStyles(makeStyles);

  const NOTIFS: NotifKey[] = [
    { key: 'bills', label: t('settings.notifBills'), sub: t('settings.notifBillsSub'), def: true },
    { key: 'budget', label: t('settings.notifBudget'), sub: t('settings.notifBudgetSub'), def: true },
    { key: 'activity', label: t('settings.notifActivity'), sub: t('settings.notifActivitySub'), def: true },
    { key: 'goals', label: t('settings.notifGoals'), sub: t('settings.notifGoalsSub'), def: false },
    { key: 'shopping', label: t('settings.notifShopping'), sub: t('settings.notifShoppingSub'), def: true },
  ];
  const [notifs, setNotifs] = useState<Record<string, boolean>>(
    Object.fromEntries(NOTIFS.map((n) => [n.key, n.def])),
  );
  const [passcode, setPasscode] = useState(false);

  // In-page nav → scroll the sections. Each section reports its y offset on layout.
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Record<SectionId, number>>({ general: 0, notifications: 0, security: 0 });
  const onSectionLayout = (id: SectionId) => (e: LayoutChangeEvent) => {
    offsets.current[id] = e.nativeEvent.layout.y;
  };
  const scrollTo = (id: SectionId) =>
    scrollRef.current?.scrollTo({ y: Math.max(0, offsets.current[id] - spacing.lg), animated: true });

  const navItems: { id: SectionId; icon: FeatherName; label: string }[] = [
    { id: 'general', icon: 'globe', label: t('settings.navGeneral') },
    { id: 'notifications', icon: 'bell', label: t('settings.navNotifications') },
    { id: 'security', icon: 'shield', label: t('settings.navSecurity') },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: t('settings.title') }} />
      <ScrollView ref={scrollRef}>
        <BentoPage>
          {!isWide ? (
            <View>
              <Text variant="title">{t('settings.title')}</Text>
              <Text muted>{t('settings.sub')}</Text>
            </View>
          ) : null}

          <BentoRow style={styles.row}>
            {/* Sticky left in-page nav — wide viewports only. */}
            {isWide ? (
              <View style={styles.navSlot}>
                <Card style={styles.navCard}>
                  {navItems.map((it, i) => (
                    <Pressable
                      key={it.id}
                      accessibilityRole="link"
                      onPress={() => scrollTo(it.id)}
                      style={({ pressed }) => [
                        styles.navItem,
                        i === 0 ? styles.navItemActive : null,
                        pressed ? styles.rowPressed : null,
                      ]}
                    >
                      <Feather name={it.icon} size={16} color={i === 0 ? palette.primary : palette.textSecondary} />
                      <Text variant="button" style={i === 0 ? styles.navLabelActive : styles.navLabel}>
                        {it.label}
                      </Text>
                    </Pressable>
                  ))}
                </Card>
              </View>
            ) : null}

            {/* Right column of section cards. */}
            <View style={styles.colSlot}>
              {/* General */}
              <View onLayout={onSectionLayout('general')}>
              <Card>
                <Text variant="heading">{t('settings.navGeneral')}</Text>
                <Text variant="caption" muted>{t('settings.generalSub')}</Text>

                <View style={[styles.rowBetween, styles.divider]}>
                  <View style={styles.rowMid}>
                    <Text variant="button">{t('settings.currencyRegion')}</Text>
                    <Text variant="caption" muted>{t('settings.currencyRegionSub')}</Text>
                  </View>
                  <View style={styles.valuePill}>
                    <Text variant="button">{active?.reporting_currency_code ?? ''}</Text>
                  </View>
                </View>

                <View style={[styles.rowBetween, styles.divider]}>
                  <View style={styles.rowMid}>
                    <Text variant="button">{t('settings.language')}</Text>
                    <Text variant="caption" muted>{t('settings.languageSub')}</Text>
                  </View>
                  <View style={styles.valuePill}>
                    <Text variant="button">{t('settings.languageValue')}</Text>
                  </View>
                </View>

                <View style={[styles.appearance, styles.divider]}>
                  <Text variant="button">{t('settings.appearance.title')}</Text>
                  <Segmented
                    options={(['system', 'light', 'dark'] as ThemeScheme[]).map((s) => ({
                      value: s,
                      label: t(`settings.appearance.${s}`),
                    }))}
                    value={scheme}
                    onChange={(s) => setScheme(s)}
                    style={styles.appearanceSeg}
                  />
                </View>
              </Card>
              </View>

              {/* Notifications */}
              <View onLayout={onSectionLayout('notifications')}>
              <Card>
                <Text variant="heading">{t('settings.navNotifications')}</Text>
                <Text variant="caption" muted>{t('settings.notificationsSub')}</Text>
                {NOTIFS.map((n) => (
                  <View key={n.key} style={[styles.rowBetween, styles.divider]}>
                    <View style={styles.rowMid}>
                      <Text variant="button">{n.label}</Text>
                      <Text variant="caption" muted>{n.sub}</Text>
                    </View>
                    <Toggle
                      value={notifs[n.key] ?? false}
                      onValueChange={(v) => setNotifs((s) => ({ ...s, [n.key]: v }))}
                      accessibilityLabel={n.label}
                    />
                  </View>
                ))}
              </Card>
              </View>

              {/* Security & privacy */}
              <View onLayout={onSectionLayout('security')}>
              <Card>
                <Text variant="heading">{t('settings.navSecurity')}</Text>
                <Text variant="caption" muted>{t('settings.securitySub')}</Text>

                <View style={[styles.rowBetween, styles.divider]}>
                  <View style={styles.rowMid}>
                    <Text variant="button">{t('settings.passcode')}</Text>
                    <Text variant="caption" muted>{t('settings.passcodeSub')}</Text>
                  </View>
                  <Toggle
                    value={passcode}
                    onValueChange={(v) => {
                      setPasscode(v);
                      if (v) toast.show(t('settings.passcodeOn'), { tone: 'info' });
                    }}
                    accessibilityLabel={t('settings.passcode')}
                  />
                </View>

                <View style={[styles.rowBetween, styles.divider]}>
                  <View style={styles.rowMid}>
                    <Text variant="button">{t('settings.exportData')}</Text>
                    <Text variant="caption" muted>{t('settings.exportSub')}</Text>
                  </View>
                  <Button
                    label={t('settings.exportData')}
                    variant="secondary"
                    onPress={() => toast.show(t('settings.exportQueued'), { tone: 'success' })}
                    style={styles.smallBtn}
                  />
                </View>

                {/* Delete account — the red danger card; flow unchanged. */}
                <View style={styles.dangerCard}>
                  <View style={styles.rowMid}>
                    <Text variant="button" style={styles.dangerTitle}>{t('settings.deleteAccount')}</Text>
                    <Text variant="caption" style={styles.dangerSub}>{t('settings.deleteAccountSub')}</Text>
                  </View>
                  <DestructiveAction
                    label={t('settings.deleteAccount')}
                    confirmLabel={t('components.tapAgain')}
                    onConfirm={() => router.push('/account')}
                  />
                </View>
              </Card>
              </View>
            </View>
          </BentoRow>
        </BentoPage>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  row: { alignItems: 'flex-start' },
  navSlot: { flexBasis: 220, flexGrow: 0, flexShrink: 1, minWidth: 180, position: 'sticky' as never, top: spacing.lg },
  navCard: { padding: spacing.sm, gap: 2 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
  },
  navItemActive: { backgroundColor: c.primaryTint },
  navLabel: { color: c.textSecondary },
  navLabelActive: { color: c.primary },
  colSlot: { flex: 1, minWidth: 0, gap: spacing.lg },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.md },
  rowMid: { flex: 1, gap: 2 },
  divider: { borderTopWidth: 1, borderTopColor: c.divider },
  valuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.fill,
  },
  appearance: { gap: spacing.sm, paddingTop: spacing.md },
  appearanceSeg: { maxWidth: 340 },
  smallBtn: { minHeight: 40, paddingHorizontal: spacing.md },
  rowPressed: { opacity: 0.6 },
  dangerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.dangerTint,
    backgroundColor: c.dangerTint,
  },
  dangerTitle: { color: c.danger },
  dangerSub: { color: c.danger, opacity: 0.9 },
});
