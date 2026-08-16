/**
 * Screen wrapper: safe-area padding + consistent background + optional title.
 * Every route renders inside a <Screen> for layout consistency.
 *
 * On wide viewports the content is centred and capped at the bento container
 * width with the larger desktop margin, so screens do not stretch edge to edge
 * on a monitor. Because nearly every route uses this, the desktop treatment
 * arrives everywhere without touching individual screens.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, spacing } from '@/components/theme';
import { CONTENT_MAX_WIDTH } from '@/components/ui/Bento';
import { Text } from '@/components/ui/Text';
import { useIsWideLayout } from '@/lib/breakpoints';

export interface ScreenProps {
  title?: string;
  children?: ReactNode;
  /** Center content vertically (used by placeholder screens). */
  centered?: boolean;
}

/** DESIGN.md margin-desktop. */
const DESKTOP_MARGIN = 40;

export function Screen({ title, children, centered = false }: ScreenProps) {
  const isWide = useIsWideLayout();
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View
        style={[
          styles.container,
          { padding: isWide ? DESKTOP_MARGIN : spacing.lg },
          centered && styles.centered,
        ]}
      >
        <View style={[styles.inner, centered && styles.innerCentered]}>
          {title ? (
            <Text variant="title" style={styles.title}>
              {title}
            </Text>
          ) : null}
          {children}
        </View>
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
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    gap: spacing.md,
  },
  centered: {
    justifyContent: 'center',
  },
  innerCentered: {
    alignItems: 'center',
  },
  title: {
    marginBottom: spacing.sm,
  },
});
