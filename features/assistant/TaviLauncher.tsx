/**
 * Floating TAVI launcher (mascot spec: 48–56px launcher, Happy at rest) — mounted
 * once at the root so it rides above every in-app page. Draggable anywhere via the
 * built-in PanResponder (no gesture-handler/reanimated dependency); it clamps to
 * the visible safe area so it can't be flung off-screen, and a tap (no real drag)
 * opens the assistant. Position is kept for the session; it resets on app restart.
 */

import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, PanResponder, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing } from '@/components/theme';
import { useThemedStyles, type Palette } from '@/components/ThemeProvider';
import { Tavi } from '@/components/ui/Tavi';

const SIZE = 60;
const MARGIN = spacing.lg;
const TAP_SLOP = 5; // movement under this (px) counts as a tap, not a drag

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export function TaviLauncher() {
  const router = useRouter();
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Recomputed each render so rotation/resize can re-clamp a stranded button.
  const bounds = {
    minX: insets.left + MARGIN,
    maxX: Math.max(insets.left + MARGIN, width - SIZE - insets.right - MARGIN),
    minY: insets.top + MARGIN,
    maxY: Math.max(insets.top + MARGIN, height - SIZE - insets.bottom - MARGIN),
  };
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const routerRef = useRef(router);
  routerRef.current = router;

  // Start bottom-right, lifted to clear the mobile tab bar. Created once.
  const pan = useRef<Animated.ValueXY | null>(null);
  if (!pan.current) {
    pan.current = new Animated.ValueXY({ x: bounds.maxX, y: Math.max(bounds.minY, bounds.maxY - 64) });
  }

  // On viewport change (rotation, web resize), pull the button back into bounds.
  useEffect(() => {
    const p = pan.current!;
    const b = boundsRef.current;
    // ponytail: __getValue() is Animated's internal read — fine for a lone FAB.
    const nx = clamp((p.x as unknown as { __getValue(): number }).__getValue(), b.minX, b.maxX);
    const ny = clamp((p.y as unknown as { __getValue(): number }).__getValue(), b.minY, b.maxY);
    Animated.spring(p, { toValue: { x: nx, y: ny }, useNativeDriver: false }).start();
  }, [width, height]);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
      onPanResponderGrant: () => {
        const p = pan.current!;
        const read = (v: Animated.Value) => (v as unknown as { __getValue(): number }).__getValue();
        p.setOffset({ x: read(p.x), y: read(p.y) });
        p.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_e, g) => {
        pan.current!.setValue({ x: g.dx, y: g.dy });
      },
      onPanResponderRelease: (_e, g) => {
        const p = pan.current!;
        p.flattenOffset();
        const b = boundsRef.current;
        const read = (v: Animated.Value) => (v as unknown as { __getValue(): number }).__getValue();
        const nx = clamp(read(p.x), b.minX, b.maxX);
        const ny = clamp(read(p.y), b.minY, b.maxY);
        Animated.spring(p, { toValue: { x: nx, y: ny }, useNativeDriver: false }).start();
        // Barely moved → treat as a tap and open the assistant.
        if (Math.abs(g.dx) < TAP_SLOP && Math.abs(g.dy) < TAP_SLOP) {
          routerRef.current.push('/assistant');
        }
      },
    }),
  ).current;

  return (
    <Animated.View
      {...responder.panHandlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel={t('assistant.openLabel')}
      onAccessibilityTap={() => router.push('/assistant')}
      style={[styles.fab, { transform: pan.current.getTranslateTransform() }]}
    >
      <Tavi pose="happy" size={44} />
    </Animated.View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    fab: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: SIZE,
      height: SIZE,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      boxShadow: '0 6px 16px rgba(15,23,42,0.18)',
    },
  });
