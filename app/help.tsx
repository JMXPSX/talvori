/** Help & Support (§6.14) — FAQ accordion (one open at a time), a feedback note,
 *  and an honest contact block. Feedback is UI + state only for now; the contact
 *  copy admits live chat isn't wired (do not imply a backend that doesn't exist). */

import { Feather } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing } from '@/components/theme';
import { useThemedStyles, useTheme, type Palette } from '@/components/ThemeProvider';
import { Button, Card, FORM_MAX_WIDTH, Text, TextField, useToast } from '@/components/ui';

const FAQ = ['1', '2', '3', '4'] as const;

export default function HelpScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [open, setOpen] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);

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
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: t('help.title') }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text variant="title">{t('help.title')}</Text>
          <Text muted>{t('help.sub')}</Text>
        </View>

        <Card>
          <Text variant="subheading">{t('help.faqTitle')}</Text>
          {FAQ.map((n, i) => {
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
                  <Feather name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={palette.textSecondary} />
                </Pressable>
                {isOpen ? <Text variant="caption" muted style={styles.faqA}>{t(`help.a${n}`)}</Text> : null}
              </View>
            );
          })}
        </Card>

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
  faqRow: { paddingVertical: spacing.sm },
  divider: { borderTopWidth: 1, borderTopColor: c.divider },
  faqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, minHeight: 32 },
  faqQ: { flex: 1 },
  faqA: { marginTop: spacing.xs, lineHeight: 18 },
  contact: { lineHeight: 18 },
});
