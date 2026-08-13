/**
 * Inline failure notice for data screens: localized message + retry button.
 * Pass copy already localized (like Button); no i18n lookups in here.
 */

import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { palette, radius, spacing } from '@/components/theme';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';

export interface ErrorNoticeProps {
  message: string;
  retryLabel: string;
  onRetry?: () => void;
}

const TILE = '#F3DBD8';

export function ErrorNotice({ message, retryLabel, onRetry }: ErrorNoticeProps) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconTile}>
          <Feather name="alert-circle" size={18} color={palette.danger} />
        </View>
        <Text style={styles.message}>{message}</Text>
      </View>
      {onRetry ? <Button label={retryLabel} variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    gap: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: TILE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: { flex: 1 },
});
