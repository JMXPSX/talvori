/** Household section stack. Nested under the root Stack (header hidden there). */

import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { palette, spacing } from '@/components/theme';

/** Header "+" that opens the create-household modal (3c). */
function HeaderAddHousehold() {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('household.createCta')}
      hitSlop={12}
      onPress={() => router.push('/household/new')}
      style={{ paddingHorizontal: spacing.md }}
    >
      <Feather name="plus" size={22} color={palette.brand} />
    </Pressable>
  );
}

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
      <Stack.Screen
        name="index"
        options={{ title: t('household.title'), headerRight: () => <HeaderAddHousehold /> }}
      />
      <Stack.Screen name="[id]" options={{ title: t('household.title') }} />
      <Stack.Screen name="join" options={{ title: t('household.joinTitle') }} />
      <Stack.Screen
        name="new"
        options={{ title: t('household.createTitle'), presentation: 'modal' }}
      />
    </Stack>
  );
}
