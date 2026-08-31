/**
 * Date field (§6.5) — a segmented `Today · Yesterday · Custom`. Today/Yesterday
 * resolve to a local ISO date; Custom reveals a `YYYY-MM-DD` input. Emits the
 * chosen ISO date (yyyy-mm-dd) via `onChange`, so the saved row's meta can show a
 * short date. Dependency-free (no native wheel) — works on web and native alike.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { spacing } from '@/components/theme';
import { CustomDateInput } from '@/components/ui/CustomDateInput';
import { Segmented } from '@/components/ui/Segmented';
import { Text } from '@/components/ui/Text';

export type DateMode = 'today' | 'yesterday' | 'custom';

export interface DateFieldProps {
  mode: DateMode;
  customDate: string;
  onModeChange: (mode: DateMode) => void;
  onCustomChange: (yyyyMmDd: string) => void;
  /** Optional inline error for an invalid custom date. */
  error?: string;
}

/** Local ISO date (yyyy-mm-dd) for a Date, honoring the device timezone. */
function localISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Resolve the current selection to an ISO date. */
export function resolveDate(mode: DateMode, customDate: string): string {
  if (mode === 'yesterday') {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return localISODate(d);
  }
  if (mode === 'custom') return customDate;
  return localISODate(new Date());
}

export function DateField({
  mode,
  customDate,
  onModeChange,
  onCustomChange,
  error,
}: DateFieldProps) {
  const { t } = useTranslation();
  const [seeded, setSeeded] = useState(false);

  function handleMode(next: DateMode) {
    // Seed the custom input with today the first time Custom opens.
    if (next === 'custom' && !customDate && !seeded) {
      onCustomChange(localISODate(new Date()));
      setSeeded(true);
    }
    onModeChange(next);
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="caption" muted>
        {t('finance.form.dateLabel')}
      </Text>
      <Segmented
        options={[
          { value: 'today', label: t('common.today') },
          { value: 'yesterday', label: t('common.yesterday') },
          { value: 'custom', label: t('common.custom') },
        ]}
        value={mode}
        onChange={handleMode}
      />
      {mode === 'custom' ? (
        <CustomDateInput value={customDate} onChange={onCustomChange} error={error} />
      ) : null}
    </View>
  );
}
