/** Settings (§6.13) — currency/region + language display, appearance (moved here
 *  from More), notification toggles, and security & privacy. Passcode/export/delete
 *  are honest: the copy admits what isn't wired, and Delete account routes to the
 *  Profile screen where the real account deletion lives. */

import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing } from '@/components/theme';
import { useThemedStyles, useTheme, type Palette, type ThemeScheme } from '@/components/ThemeProvider';
import {
  Button,
  Card,
  DestructiveAction,
  FORM_MAX_WIDTH,
  Segmented,
  Text,
  Toggle,
  useToast,
} from '@/components/ui';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';

interface NotifKey { key: string; label: string; sub: string; def: boolean }

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { active } = useActiveHousehold();
  const { scheme, setScheme } = useTheme();
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

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: t('settings.title') }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text variant="title">{t('settings.title')}</Text>
          <Text muted>{t('settings.sub')}</Text>
        </View>

        <Card>
          <View style={styles.rowBetween}>
            <View style={styles.rowMid}>
              <Text variant="button">{t('settings.currencyRegion')}</Text>
              <Text variant="caption" muted>{t('settings.currencyRegionSub')}</Text>
            </View>
            <Text variant="button">{active?.reporting_currency_code ?? ''}</Text>
          </View>
          <View style={[styles.rowBetween, styles.divider]}>
            <View style={styles.rowMid}>
              <Text variant="button">{t('settings.language')}</Text>
              <Text variant="caption" muted>{t('settings.languageSub')}</Text>
            </View>
            <Text variant="button">{t('settings.languageValue')}</Text>
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
            />
          </View>
        </Card>

        <Text variant="eyebrow" muted>{t('settings.notificationsSection')}</Text>
        <Card>
          {NOTIFS.map((n, i) => (
            <View key={n.key} style={[styles.rowBetween, i > 0 ? styles.divider : null]}>
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

        <Text variant="eyebrow" muted>{t('settings.securitySection')}</Text>
        <Card>
          <View style={styles.rowBetween}>
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
            <Button label={t('settings.exportData')} variant="secondary" onPress={() => toast.show(t('settings.exportQueued'), { tone: 'success' })} style={styles.smallBtn} />
          </View>
          <View style={[styles.rowBetween, styles.divider]}>
            <View style={styles.rowMid}>
              <Text variant="button">{t('settings.deleteAccount')}</Text>
              <Text variant="caption" muted>{t('settings.deleteAccountSub')}</Text>
            </View>
            <DestructiveAction
              label={t('settings.deleteAccount')}
              confirmLabel={t('components.tapAgain')}
              onConfirm={() => router.push('/account')}
            />
          </View>
        </Card>
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
    maxWidth: FORM_MAX_WIDTH,
    alignSelf: 'center',
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm },
  rowMid: { flex: 1, gap: 2 },
  divider: { borderTopWidth: 1, borderTopColor: c.divider },
  appearance: { gap: spacing.sm, paddingTop: spacing.md },
  smallBtn: { minHeight: 40, paddingHorizontal: spacing.md },
});
