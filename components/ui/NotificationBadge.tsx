/** Small unread-count pill. Renders nothing when count is 0; caps at "9+". */

import { StyleSheet, View } from 'react-native';

import { useThemedStyles, type Palette } from '@/components/ThemeProvider';
import { Text } from '@/components/ui/Text';

export interface NotificationBadgeProps {
  count: number;
}

export function NotificationBadge({ count }: NotificationBadgeProps) {
  const styles = useThemedStyles(makeStyles);
  if (count <= 0) return null;
  return (
    <View style={styles.badge} pointerEvents="none">
      <Text style={styles.text} numberOfLines={1}>
        {count > 9 ? '9+' : String(count)}
      </Text>
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: c.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: c.white,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
});
