/** More tab: profile card, navigation rows, and sign-out. */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { radius, spacing, type Palette } from '@/components/theme';
import { useThemedStyles, useTheme, type ThemeScheme } from '@/components/ThemeProvider';
import { Button, Card, Chip, ListRow, Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePlan } from '@/features/billing/EntitlementsProvider';

const SCHEMES: readonly ThemeScheme[] = ['system', 'light', 'dark'];

/** "Maria Santos" → "MS", "Joseph" → "JO", "maria.santos@x" → "MS". */
function initialsFor(displayName: string | null, email: string): string {
  const source = displayName?.trim() || email.split('@')[0] || '';
  const parts = source.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const letters =
    parts.length >= 2
      ? `${parts[0]?.charAt(0) ?? ''}${parts[1]?.charAt(0) ?? ''}`
      : source.slice(0, 2);
  return letters.toUpperCase();
}

export default function MoreScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { has } = usePlan();
  const { palette, scheme, setScheme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [busy, setBusy] = useState(false);

  const email = user?.email ?? '';
  const displayName =
    typeof user?.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : null;

  async function onSignOut() {
    setBusy(true);
    try {
      await signOut();
      // Auth gate redirects to /login once the session clears.
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title={t('screens.moreTitle')}>
      {email ? (
        <Card>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text variant="heading" style={styles.avatarText}>
                {initialsFor(displayName, email)}
              </Text>
            </View>
            <View style={styles.profileMid}>
              {displayName ? <Text variant="heading">{displayName}</Text> : null}
              <Text variant={displayName ? 'caption' : 'body'} muted numberOfLines={1}>
                {email}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      <View style={styles.rows}>
        <ListRow icon="users" label={t('household.open')} onPress={() => router.push('/household')} />
        <ListRow icon="shopping-bag" label={t('retail.open')} onPress={() => router.push('/retail')} />
        {has('multi_currency_dashboard') ? (
          <ListRow
            icon="bar-chart-2"
            label={t('insights.title')}
            iconColor={palette.accent}
            iconBg={palette.accentMuted}
            onPress={() => router.push('/finance/insights')}
          />
        ) : null}
        <ListRow icon="star" label={t('billing.open')} onPress={() => router.push('/subscription')} />
        <ListRow icon="user" label={t('account.open')} onPress={() => router.push('/account')} />
      </View>

      <View style={styles.section}>
        <Text variant="eyebrow" muted>{t('settings.appearance.title')}</Text>
        <View style={styles.segment}>
          {SCHEMES.map((s) => (
            <Chip
              key={s}
              label={t(`settings.appearance.${s}`)}
              selected={scheme === s}
              role="radio"
              onPress={() => setScheme(s)}
            />
          ))}
        </View>
        <Text variant="caption" muted>{t('settings.appearance.hint')}</Text>
      </View>

      <View style={styles.actions}>
        <Button label={t('auth.signOut')} variant="secondary" onPress={onSignOut} loading={busy} />
      </View>
    </Screen>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: radius.pill,
      backgroundColor: c.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: c.white },
    profileMid: { flex: 1, gap: 2 },
    rows: { gap: spacing.sm, marginTop: spacing.sm },
    section: { gap: spacing.sm, marginTop: spacing.lg },
    segment: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    actions: { marginTop: spacing.lg },
  });
