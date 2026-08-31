/** Grocery tab: household shopping lists (live). Creation lives behind the
 *  header "+" which opens the /grocery/new modal. */

import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, spacing } from '@/components/theme';
import { useThemedStyles, useTheme, type Palette } from '@/components/ThemeProvider';
import { Card, CONTENT_MAX_WIDTH, EmptyState, ErrorNotice, Text } from '@/components/ui';
import { listLists, subscribeToLists } from '@/features/grocery/api';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { GroceryListRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';

export default function GroceryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { active } = useActiveHousehold();
  const styles = useThemedStyles(makeStyles);
  const { palette } = useTheme();

  const [lists, setLists] = useState<GroceryListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      setLists(await listLists(active.id));
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [active]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Live updates while the tab is mounted.
  useEffect(() => {
    if (!active) return;
    const unsub = subscribeToLists(active.id, () => void load());
    return unsub;
  }, [active, load]);

  const activeLists = lists.filter((l) => l.status === 'active');
  const completed = lists.filter((l) => l.status === 'completed');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text variant="title">{t('screens.groceryTitle')}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('grocery.newCta')}
            onPress={() => router.push('/grocery/new')}
            style={({ pressed }) => [styles.addButton, pressed ? styles.pressed : null]}
          >
            <Feather name="plus" size={22} color={palette.white} />
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={palette.brand} />
        ) : errorKey ? (
          <ErrorNotice message={t(errorKey)} retryLabel={t('common.retry')} onRetry={() => void load()} />
        ) : lists.length === 0 ? (
          <EmptyState
            icon="shopping-cart"
            message={t('grocery.empty')}
            ctaLabel={t('grocery.newCta')}
            onCta={() => router.push('/grocery/new')}
          />
        ) : (
          <View style={styles.groups}>
            {activeLists.length > 0 && (
              <View style={styles.group}>
                <Text variant="eyebrow" muted>
                  {t('grocery.activeSection')}
                </Text>
                {activeLists.map((l) => (
                  <Card key={l.id} onPress={() => router.push(`/grocery/${l.id}`)}>
                    <Text variant="subheading">{l.name}</Text>
                    <Text variant="caption" muted>
                      {l.currency_code}
                    </Text>
                  </Card>
                ))}
              </View>
            )}
            {completed.length > 0 && (
              <View style={styles.group}>
                <Text variant="eyebrow" muted>
                  {t('grocery.completedSection')}
                </Text>
                {completed.map((l) => (
                  <Card
                    key={l.id}
                    style={styles.cardDone}
                    onPress={() => router.push(`/grocery/${l.id}`)}
                  >
                    <View style={styles.doneTile}>
                      <Feather name="check" size={18} color={palette.success} />
                    </View>
                    <View style={styles.doneMid}>
                      <Text variant="subheading">{l.name}</Text>
                      <Text variant="caption" muted>
                        {t('grocery.completedNote')}
                      </Text>
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    // Cap + centre so the screen does not stretch edge to edge on a monitor.
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: c.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.9 },
  groups: { gap: spacing.md },
  group: { gap: spacing.sm },
  cardDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    opacity: 0.75,
  },
  doneTile: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: c.successMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneMid: { flex: 1, gap: 2 },
});
