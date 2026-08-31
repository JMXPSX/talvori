/** Grocery section stack (list detail screens open on top of the tab). */

import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/components/ThemeProvider';

export default function GroceryLayout() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.background },
        headerTintColor: palette.text,
        contentStyle: { backgroundColor: palette.background },
      }}
    >
      <Stack.Screen name="[id]" options={{ title: t('grocery.title') }} />
      <Stack.Screen
        name="new"
        options={{ title: t('grocery.newListTitle'), presentation: 'modal' }}
      />
      <Stack.Screen name="link/[itemId]" options={{ title: t('grocery.selectProduct') }} />
      <Stack.Screen name="compare/[id]" options={{ title: t('grocery.compare.title') }} />
    </Stack>
  );
}
