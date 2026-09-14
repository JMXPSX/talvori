/**
 * TAVI assistant chat (§ mascot spec: chat empty state uses full-body Happy;
 * the waiting/typing state uses Thinking). A plain message list with a pill
 * composer; the model call runs server-side (features/assistant/api.ts →
 * `assistant-chat` Edge Function) so no key is ever on the client.
 */

import { Feather } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, spacing } from '@/components/theme';
import { useThemedStyles, useTheme, type Palette } from '@/components/ThemeProvider';
import { Text, useToast } from '@/components/ui';
import { Tavi } from '@/components/ui/Tavi';
import { sendChat, type ChatMessage } from '@/features/assistant/api';
import { toAppError } from '@/lib/errors';

const webNoOutline: TextStyle | null =
  Platform.OS === 'web' ? ({ outlineWidth: 0 } as TextStyle) : null;

export default function AssistantScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  async function onSend() {
    const content = input.trim();
    if (!content || sending) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      const reply = await sendChat(next);
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch (err) {
      toast.show(t(toAppError(err).messageKey), { tone: 'error' });
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: t('assistant.title') }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 ? (
            <View style={styles.greeting}>
              <Tavi pose="happy" size={112} />
              <Text variant="title" style={styles.greetTitle}>{t('assistant.greetingTitle')}</Text>
              <Text muted style={styles.greetBody}>{t('assistant.greetingBody')}</Text>
              <Text variant="caption" muted style={styles.greetBody}>{t('assistant.disclaimer')}</Text>
            </View>
          ) : (
            messages.map((m, i) => {
              const mine = m.role === 'user';
              return (
                <View
                  key={i}
                  style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTavi]}
                >
                  <Text style={mine ? styles.textMine : undefined}>{m.content}</Text>
                </View>
              );
            })
          )}
          {sending ? (
            <View style={styles.thinkingRow}>
              <Tavi pose="thinking" size={32} />
              <Text variant="caption" muted>{t('assistant.thinking')}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t('assistant.placeholder')}
            placeholderTextColor={palette.textMuted}
            multiline
            editable={!sending}
            accessibilityLabel={t('assistant.placeholder')}
            style={[styles.input, webNoOutline]}
            onSubmitEditing={onSend}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('assistant.send')}
            disabled={sending || input.trim().length === 0}
            onPress={onSend}
            style={({ pressed }) => [
              styles.sendBtn,
              (sending || input.trim().length === 0) ? styles.sendDisabled : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Feather name="arrow-up" size={20} color={palette.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
    greeting: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xl, paddingHorizontal: spacing.md },
    greetTitle: { textAlign: 'center' },
    greetBody: { textAlign: 'center' },
    bubble: {
      maxWidth: '86%',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
    },
    bubbleMine: { alignSelf: 'flex-end', backgroundColor: c.brand },
    bubbleTavi: { alignSelf: 'flex-start', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    textMine: { color: c.white },
    thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start' },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      padding: spacing.md,
      borderTopWidth: 1,
      borderTopColor: c.divider,
      backgroundColor: c.background,
    },
    input: {
      flex: 1,
      minWidth: 0,
      maxHeight: 120,
      minHeight: 44,
      color: c.text,
      backgroundColor: c.field,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.brand,
    },
    sendDisabled: { opacity: 0.4 },
    pressed: { opacity: 0.7 },
  });
