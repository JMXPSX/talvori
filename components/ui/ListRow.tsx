/**
 * Navigation row: icon tile + label (+ optional sublabel) + optional trailing
 * detail + a direction-aware chevron. Card-style surface with the quiet shadow.
 */

import { Feather } from '@expo/vector-icons';
import { I18nManager, Pressable, type PressableStateCallbackType, StyleSheet, View } from 'react-native';

import { elevation, focus, palette, radius, spacing } from '@/components/theme';
import { Text } from '@/components/ui/Text';

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
  iconColor = palette.brand,
  iconBg = palette.brandMuted,
}: ListRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={(state) => {
        const { pressed, focused } = state as PressableStateCallbackType & {
          focused?: boolean;
        };
        return [styles.row, pressed ? styles.pressed : null, focused ? styles.focused : null];
      }}
    >
      <View style={[styles.iconTile, { backgroundColor: iconBg }]}>
        <Feather name={icon} size={20} color={iconColor} />
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

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
    boxShadow: elevation.tile,
  },
  pressed: { opacity: 0.9 },
  // Compose the focus ring with the resting tile shadow so depth is kept.
  focused: { boxShadow: `${elevation.tile}, ${focus.ring}` },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mid: { flex: 1, gap: 2 },
});
