/**
 * Custom-date input — native (iOS/Android). A pressable field that opens the
 * platform date picker (@react-native-community/datetimepicker, bundled in Expo
 * Go). Value is an ISO date (yyyy-mm-dd). Web uses CustomDateInput.tsx instead.
 */

import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/components/theme';
import { useTheme, useThemedStyles, type Palette } from '@/components/ThemeProvider';
import { Text } from '@/components/ui/Text';

export interface CustomDateInputProps {
  value: string;
  onChange: (yyyyMmDd: string) => void;
  error?: string;
  /** Cap the selectable range at today (default). Bills need future dates → false. */
  maxToday?: boolean;
}

/** Local ISO date (yyyy-mm-dd), honoring the device timezone. */
function localISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function CustomDateInput({ value, onChange, error, maxToday = true }: CustomDateInputProps) {
  const { t, i18n } = useTranslation();
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [show, setShow] = useState(false);

  // Parse at local noon so the yyyy-mm-dd never drifts a day across timezones.
  const selected = value ? new Date(`${value}T12:00:00`) : new Date();
  const label = value
    ? new Intl.DateTimeFormat(i18n.language, { year: 'numeric', month: 'short', day: 'numeric' }).format(selected)
    : t('finance.form.customDatePlaceholder');

  function onPick(event: DateTimePickerEvent, picked?: Date) {
    // Android closes the dialog itself; iOS shows inline and updates live.
    if (Platform.OS === 'android') setShow(false);
    if (event.type === 'set' && picked) onChange(localISODate(picked));
  }

  return (
    <View style={{ gap: spacing.xs }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('finance.form.dateLabel')}
        onPress={() => setShow(true)}
        style={({ pressed }) => [styles.trigger, pressed ? styles.pressed : null]}
      >
        <Text style={value ? undefined : styles.placeholder}>{label}</Text>
        <Feather name="calendar" size={18} color={palette.textMuted} />
      </Pressable>
      {show ? (
        <DateTimePicker
          value={selected}
          mode="date"
          display="default"
          maximumDate={maxToday ? new Date() : undefined}
          onChange={onPick}
        />
      ) : null}
      {error ? (
        <Text variant="caption" style={{ color: palette.danger }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  trigger: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: c.field,
  },
  placeholder: { color: c.textMuted },
  pressed: { opacity: 0.85 },
});
