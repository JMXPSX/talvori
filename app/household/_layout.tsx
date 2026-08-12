/** Household section stack. Nested under the root Stack (header hidden there). */

import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { palette } from '@/components/theme';

export default function HouseholdLayout() {
  const { t } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.background },
        headerTintColor: palette.text,
        contentStyle: { backgroundColor: palette.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: t('household.title') }} />
      <Stack.Screen name="[id]" options={{ title: t('household.title') }} />
      <Stack.Screen name="join" options={{ title: t('household.joinTitle') }} />
    </Stack>
  );
}
