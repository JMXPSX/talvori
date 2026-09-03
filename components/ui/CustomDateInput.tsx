/**
 * Custom-date input — web/default implementation. Uses the browser-native
 * <input type="date"> (react-native-web renders to the DOM), which gives a real
 * calendar picker for free. Native (iOS/Android) uses CustomDateInput.native.tsx
 * with the community date picker. Value is an ISO date (yyyy-mm-dd).
 */

import { useTranslation } from 'react-i18next';

import { useTheme } from '@/components/ThemeProvider';
import { Text } from '@/components/ui/Text';

export interface CustomDateInputProps {
  value: string;
  onChange: (yyyyMmDd: string) => void;
  error?: string;
  /** Cap the selectable range at today (default). Bills need future dates → false. */
  maxToday?: boolean;
}

function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function CustomDateInput({ value, onChange, error, maxToday = true }: CustomDateInputProps) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <input
        type="date"
        value={value}
        max={maxToday ? todayISO() : undefined}
        onChange={(e) => onChange(e.target.value)}
        aria-label={t('finance.form.dateLabel')}
        style={{
          padding: 12,
          borderRadius: 10,
          border: `1px solid ${palette.border}`,
          backgroundColor: palette.field,
          color: palette.text,
          fontSize: 14,
        }}
      />
      {error ? (
        <Text variant="caption" style={{ color: palette.danger }}>
          {error}
        </Text>
      ) : null}
    </div>
  );
}
