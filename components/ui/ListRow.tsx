/**
 * Navigation row: icon tile + label (+ optional sublabel) + optional trailing
 * detail + a direction-aware chevron. Card-style surface with the quiet shadow.
 */

import { Feather } from '@expo/vector-icons';
import {
  I18nManager,
  Pressable,
  type PressableStateCallbackType,
  StyleSheet,
  View,
} from 'react-native';

import { elevation, radius, spacing, webFocusRing } from '@/components/theme';
import { useTheme, useThemedStyles, type Palette } from '@/components/ThemeProvider';
import { Text } from '@/components/ui/Text';

/** react-native-web adds `hovered`/`focused` to the Pressable state callback. */
type WebPressableState = PressableStateCallbackType & { hovered?: boolean; focused?: boolean };

export interface ListRowProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  sublabel?: string;
  detail?: string;
  onPress?: () => void;
  iconColor?: string;
  iconBg?: string;
}

export function ListRow({
  icon,
  label,
  sublabel,
  detail,
  onPress,
  iconColor,
  iconBg,
}: ListRowProps) {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const resolvedIconColor = iconColor ?? palette.brand;
  const resolvedIconBg = iconBg ?? palette.brandMuted;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={(state) => {
        const { pressed, hovered, focused } = state as WebPressableState;
        return [
          styles.row,
          hovered ? styles.hovered : null,
          pressed ? styles.pressed : null,
          focused ? webFocusRing : null,
        ];
      }}
    >
      <View style={[styles.iconTile, { backgroundColor: resolvedIconBg }]}>
        <Feather name={icon} size={20} color={resolvedIconColor} />
      </View>
      <View style={styles.mid}>
        {/* `button` is the 16/600 role — `heading` is 24px and overpowers a row. */}
        <Text variant="button">{label}</Text>
        {sublabel ? (
          <Text variant="caption" muted>
            {sublabel}
          </Text>
        ) : null}
      </View>
      {detail ? (
        <Text variant="caption" muted>
          {detail}
        </Text>
      ) : null}
      <Feather
        name={I18nManager.isRTL ? 'chevron-left' : 'chevron-right'}
        size={20}
        color={palette.textMuted}
      />
    </Pressable>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: c.surface,
    boxShadow: elevation.tile,
  },
  hovered: { backgroundColor: c.field },
  pressed: { opacity: 0.9 },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mid: { flex: 1, gap: 2 },
});
