/** Grocery section stack (list detail screens open on top of the tab). */

import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { palette } from '@/components/theme';

export default function GroceryLayout() {
  const { t } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.background },
        headerTintColor: palette.text,
        contentStyle: { backgroundColor: palette.background },
      }}
    >
      <Stack.Screen name="[id]" options={{ title: t('grocery.title') }} />
    </Stack>
  );
}
