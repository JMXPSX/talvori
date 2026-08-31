/**
 * Friendly empty state: a muted icon, a message, and an optional primary CTA.
 * Use instead of bare "No X yet." text on list screens.
 */

import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/components/theme';
import { useTheme } from '@/components/ThemeProvider';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';

export interface EmptyStateProps {
  icon?: keyof typeof Feather.glyphMap;
  message: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function EmptyState({ icon = 'inbox', message, ctaLabel, onCta }: EmptyStateProps) {
  const { palette } = useTheme();
  return (
    <View style={styles.wrap}>
      <Feather name={icon} size={40} color={palette.textMuted} />
      <Text muted style={styles.msg}>
        {message}
      </Text>
      {ctaLabel && onCta ? <Button label={ctaLabel} onPress={onCta} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  msg: { textAlign: 'center' },
});
