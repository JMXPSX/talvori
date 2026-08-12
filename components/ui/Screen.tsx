/**
 * Screen wrapper: safe-area padding + consistent background + optional title.
 * Every route renders inside a <Screen> for layout consistency.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, spacing } from '@/components/theme';
import { Text } from '@/components/ui/Text';

export interface ScreenProps {
  title?: string;
  children?: ReactNode;
  /** Center content vertically (used by placeholder screens). */
  centered?: boolean;
}

export function Screen({ title, children, centered = false }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={[styles.container, centered && styles.centered]}>
        {title ? (
          <Text variant="title" style={styles.title}>
            {title}
          </Text>
        ) : null}
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.background,
  },
  container: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    marginBottom: spacing.sm,
  },
});
