/** Help & Support (§6.14) — dark search hero over a two-column bento: an FAQ
 *  accordion (one open at a time, filterable by the hero search) beside a
 *  feedback + honest-contact column. Feedback is UI + state only; the contact
 *  copy admits live chat isn't wired (do not imply a backend that doesn't exist).
 *  Redesigned to the Talvori desktop mock; stacks on mobile via BentoRow. */

import { Feather } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, spacing } from '@/components/theme';
import { useThemedStyles, useTheme, type Palette } from '@/components/ThemeProvider';
import { BentoPage, BentoRow, Button, Card, Text, TextField, useToast } from '@/components/ui';

const FAQ = ['1', '2', '3', '4'] as const;

// The hero pill draws its own border; suppress the web <input> focus outline.
const webNoOutline: TextStyle | null =
  Platform.OS === 'web' ? ({ outlineWidth: 0 } as TextStyle) : null;

export default function HelpScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Local FAQ filter — matches the hero search box against each question/answer.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQ as readonly string[];
    return FAQ.filter(
      (n) =>
        t(`help.q${n}`).toLowerCase().includes(q) || t(`help.a${n}`).toLowerCase().includes(q),
    );
  }, [query, t]);

  const suggestions = ['s1', 's2', 's3', 's4'] as const;

  function onSend() {
    if (!feedback.trim()) {
      setError('help.feedbackEmpty');
      return;
    }
    setError(null);
    setFeedback('');
    toast.show(t('help.feedbackSent'), { tone: 'success' });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: t('help.title') }} />
      <ScrollView>
        <BentoPage>
          {/* Dark search hero — headline, search box, quick suggestion chips. */}
          <View style={styles.hero}>
            <Text variant="title" style={styles.heroTitle}>{t('help.sub')}</Text>
            <View style={styles.search}>
              <Feather name="search" size={18} color="rgba(255,255,255,0.6)" style={styles.searchIcon} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('help.searchPlaceholder')}
                placeholderTextColor="rgba(255,255,255,0.6)"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={t('help.searchPlaceholder')}
                style={[styles.searchInput, webNoOutline]}
              />
            </View>
            <View style={styles.chips}>
              {suggestions.map((s) => (
                <Pressable
                  key={s}
                  accessibilityRole="button"
                  onPress={() => setQuery(t(`help.${s}`))}
                  style={({ pressed }) => [styles.chip, pressed ? styles.pressed : null]}
                >
                  <Text variant="caption" style={styles.chipText}>{t(`help.${s}`)}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <BentoRow>
            {/* FAQ accordion — one open at a time, filtered by the hero search. */}
            <Card style={styles.faqSlot}>
              <Text variant="subheading">{t('help.faqTitle')}</Text>
              <Text variant="caption" muted>{t('help.faqOneAtATime')}</Text>
              <View style={styles.faqList}>
                {filtered.length === 0 ? (
                  <Text variant="caption" muted style={styles.noResults}>
                    {t('help.noResults', { query: query.trim() })}
                  </Text>
                ) : (
                  filtered.map((n, i) => {
                    const isOpen = open === n;
                    return (
                      <View key={n} style={[styles.faqRow, i > 0 ? styles.divider : null]}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ expanded: isOpen }}
                          onPress={() => setOpen(isOpen ? null : n)}
                          style={styles.faqHeader}
                        >
                          <Text variant="button" style={styles.faqQ}>{t(`help.q${n}`)}</Text>
                          <Feather
                            name={isOpen ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color={palette.textSecondary}
                          />
                        </Pressable>
                        {isOpen ? (
                          <Text variant="caption" muted style={styles.faqA}>{t(`help.a${n}`)}</Text>
                        ) : null}
                      </View>
                    );
                  })
                )}
              </View>
            </Card>

            {/* Right column — feedback (state only) + honest contact block. */}
            <View style={styles.sideCol}>
              <Card>
                <Text variant="subheading">{t('help.feedbackTitle')}</Text>
                <Text variant="caption" muted>{t('help.feedbackSub')}</Text>
                <TextField
                  label={t('help.feedbackTitle')}
                  value={feedback}
                  onChangeText={setFeedback}
                  placeholder={t('help.feedbackPlaceholder')}
                  autoCapitalize="sentences"
                  error={error ? t(error) : undefined}
                />
                <Button label={t('help.feedbackSend')} onPress={onSend} />
              </Card>

              <Card>
                <Text variant="subheading">{t('help.contactTitle')}</Text>
                <Text variant="caption" muted style={styles.contact}>{t('help.contactBody')}</Text>
              </Card>
            </View>
          </BentoRow>
        </BentoPage>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  hero: {
    backgroundColor: c.ink,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  heroTitle: { color: c.white },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: spacing.md,
    minHeight: 50,
  },
  searchIcon: { marginRight: spacing.sm },
  searchInput: { flex: 1, minWidth: 0, color: c.white, paddingVertical: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  chipText: { color: c.white },
  pressed: { opacity: 0.6 },
  faqSlot: { flex: 1.45, minWidth: 0 },
  sideCol: { flex: 1, minWidth: 0, gap: spacing.lg },
  faqList: { marginTop: spacing.sm },
  noResults: { paddingVertical: spacing.md },
  faqRow: { paddingVertical: spacing.sm },
  divider: { borderTopWidth: 1, borderTopColor: c.divider },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 32,
  },
  faqQ: { flex: 1 },
  faqA: { marginTop: spacing.xs, lineHeight: 18 },
  contact: { lineHeight: 18 },
});
