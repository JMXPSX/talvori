/**
 * Household switcher popover (§5.4, §6.4). Lists the households you belong to (with
 * the active one checked), and offers inline Create and Join-with-a-code panels,
 * plus a Manage link into the Household screen. Switching swaps the whole data
 * bundle + currency via the ActiveHouseholdProvider; transient screen UI resets on
 * the next focus/reload. Join uses the migration-15 join_household_by_code RPC.
 */

import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { elevation, radius, spacing } from '@/components/theme';
import { useThemedStyles, useTheme, type Palette } from '@/components/ThemeProvider';
import { Button, CurrencyField, Text, TextField, useToast } from '@/components/ui';
import { createHousehold, joinHouseholdByCode, listMyMemberCounts } from '@/features/household/api';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { defaultCurrencyCode } from '@/lib/defaults';
import { toAppError } from '@/lib/errors';

type Panel = 'none' | 'create' | 'join';

export function HouseholdSwitcher({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { households, active, setActiveId, refresh } = useActiveHousehold();

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [panel, setPanel] = useState<Panel>('none');
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(defaultCurrencyCode());
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorArg, setErrorArg] = useState<Record<string, string> | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setPanel('none');
      setError(null);
      listMyMemberCounts().then(setCounts).catch(() => setCounts({}));
    }
  }, [visible]);

  function switchTo(id: string) {
    if (id !== active?.id) {
      setActiveId(id);
      const h = households.find((x) => x.id === id);
      if (h) toast.show(t('home.switched', { name: h.name }), { tone: 'success' });
    }
    onClose();
  }

  async function onCreate() {
    setError(null);
    if (!name.trim()) return setError('home.nameRequired');
    if (households.some((h) => h.name.trim().toLowerCase() === name.trim().toLowerCase())) {
      return setError('home.dupName');
    }
    setBusy(true);
    try {
      const created = await createHousehold({ name: name.trim(), reportingCurrencyCode: currency, isCrossBorder: false });
      await refresh();
      setActiveId(created.id);
      toast.show(t('home.created', { name: created.name }), { tone: 'success' });
      setName('');
      onClose();
    } catch (err) {
      setError(toAppError(err).messageKey);
    } finally {
      setBusy(false);
    }
  }

  async function onJoin() {
    setError(null);
    setErrorArg(undefined);
    if (!code.trim()) return;
    setBusy(true);
    try {
      const joined = await joinHouseholdByCode(code);
      await refresh();
      setActiveId(joined.id);
      toast.show(t('home.joined', { name: joined.name }), { tone: 'success' });
      setCode('');
      onClose();
    } catch (err) {
      const key = toAppError(err).messageKey;
      setError(key);
      if (key === 'household.errors.codeNotFound') setErrorArg({ code: code.trim().toUpperCase() });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <ScrollView>
            <Text variant="eyebrow" muted>{t('home.yourHouseholds')}</Text>
            {households.map((h) => (
              <Pressable
                key={h.id}
                accessibilityRole="button"
                accessibilityState={{ selected: h.id === active?.id }}
                onPress={() => switchTo(h.id)}
                style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
              >
                <View style={styles.rowMid}>
                  <Text variant="button">{h.name}</Text>
                  <Text variant="caption" muted>
                    {t(counts[h.id] === 1 ? 'home.memberCount_one' : 'home.memberCount_other', { count: counts[h.id] ?? 1, code: h.code })}
                  </Text>
                </View>
                {h.id === active?.id ? <Feather name="check" size={18} color={palette.primary} /> : null}
              </Pressable>
            ))}

            {panel === 'create' ? (
              <View style={styles.panel}>
                <TextField label={t('household.nameLabel')} value={name} onChangeText={setName} autoCapitalize="words" />
                <CurrencyField label={t('household.currencyLabel')} value={currency} onChange={setCurrency} suggested={[defaultCurrencyCode()].filter(Boolean)} />
                <Text variant="caption" muted>{t('home.createHelper')}</Text>
                {error ? <Text variant="caption" style={styles.error}>{t(error)}</Text> : null}
                <View style={styles.panelBtns}>
                  <Button label={t('home.create')} onPress={onCreate} loading={busy} style={styles.flex1} />
                  <Button label={t('common.cancel')} variant="secondary" onPress={() => { setPanel('none'); setError(null); }} style={styles.flex1} />
                </View>
              </View>
            ) : panel === 'join' ? (
              <View style={styles.panel}>
                <TextField label={t('home.joinWithCode')} value={code} onChangeText={(v) => setCode(v.toUpperCase())} placeholder={t('home.joinPlaceholder')} autoCapitalize="characters" />
                {error ? <Text variant="caption" style={styles.error}>{t(error, errorArg)}</Text> : null}
                <View style={styles.panelBtns}>
                  <Button label={t('home.join')} onPress={onJoin} loading={busy} style={styles.flex1} />
                  <Button label={t('common.cancel')} variant="secondary" onPress={() => { setPanel('none'); setError(null); }} style={styles.flex1} />
                </View>
              </View>
            ) : (
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" onPress={() => { setPanel('create'); setError(null); }} style={styles.actionRow}>
                  <Text variant="button" style={styles.link}>{t('home.createHousehold')}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => { setPanel('join'); setError(null); }} style={styles.actionRow}>
                  <Text variant="button" style={styles.link}>{t('home.joinWithCode')}</Text>
                </Pressable>
                {active ? (
                  <Pressable accessibilityRole="button" onPress={() => { onClose(); router.push(`/household/${active.id}`); }} style={styles.actionRow}>
                    <Text variant="button" muted>{t('home.manageHousehold')}</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'center', padding: spacing.lg },
  sheet: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    maxHeight: '80%',
    padding: spacing.md,
    gap: spacing.xs,
    boxShadow: elevation.raised,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, paddingVertical: spacing.sm },
  rowMid: { flex: 1, gap: 2 },
  pressed: { opacity: 0.7 },
  actions: { marginTop: spacing.sm, gap: spacing.xs, borderTopWidth: 1, borderTopColor: c.divider, paddingTop: spacing.sm },
  actionRow: { minHeight: 44, justifyContent: 'center' },
  link: { color: c.primary },
  panel: { marginTop: spacing.sm, gap: spacing.sm, borderTopWidth: 1, borderTopColor: c.divider, paddingTop: spacing.md },
  panelBtns: { flexDirection: 'row', gap: spacing.sm },
  flex1: { flex: 1 },
  error: { color: c.danger },
});
