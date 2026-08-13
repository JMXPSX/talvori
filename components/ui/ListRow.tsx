/**
 * Navigation row: icon tile + label (+ optional sublabel) + optional trailing
 * detail + a direction-aware chevron. Card-style surface with the quiet shadow.
 */

import { Feather } from '@expo/vector-icons';
import { I18nManager, Pressable, StyleSheet, View } from 'react-native';

import { palette, radius, spacing } from '@/components/theme';
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
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View style={[styles.iconTile, { backgroundColor: iconBg }]}>
        <Feather name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.mid}>
        <Text variant="heading">{label}</Text>
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
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    shadowColor: '#0A4E42',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
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
