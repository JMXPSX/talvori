/** Create-household modal (3c — fixes F13/F19/F25; folds in 4b). Moves the create
 *  form out of the list screen: name, reporting currency (via the 3b picker), and
 *  the 4b cross-border question rendered as a two-card radio choice with its
 *  "what it activates" explainer. Closes to the new household. */

import { Feather } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  type PressableStateCallbackType,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, spacing, webFocusRing } from '@/components/theme';
import { useThemedStyles, useTheme, type Palette } from '@/components/ThemeProvider';
import { Button, CurrencyField, FORM_MAX_WIDTH, Text, TextField } from '@/components/ui';
import { createHousehold } from '@/features/household/api';
import { createHouseholdSchema } from '@/features/household/schemas';
import { defaultCurrencyCode } from '@/lib/defaults';
import { toAppError } from '@/lib/errors';
import { direction } from '@/lib/rtl';
import { validate } from '@/lib/validation';

/** react-native-web adds `hovered`/`focused` to the Pressable state callback. */
type WebPressableState = PressableStateCallbackType & { hovered?: boolean; focused?: boolean };

export default function HouseholdNewScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const { palette } = useTheme();

  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(defaultCurrencyCode());
  const [crossBorder, setCrossBorder] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onCreate() {
    setFormError(null);
    const result = validate(createHouseholdSchema, {
      name,
      reportingCurrencyCode: currency,
      isCrossBorder: crossBorder,
    });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const created = await createHousehold(result.data);
      router.replace(`/household/${created.id}`);
    } catch (err) {
      setFormError(toAppError(err).messageKey);
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <TextField
          label={t('household.nameLabel')}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          error={fieldErrors.name ? t('errors.validation') : undefined}
        />
        <CurrencyField
          label={t('household.currencyLabel')}
          value={currency}
          onChange={setCurrency}
          suggested={[defaultCurrencyCode()].filter(Boolean)}
          error={fieldErrors.reportingCurrencyCode ? t('errors.validation') : undefined}
        />

        <View style={styles.crossBorder}>
          <Text variant="subheading">{t('household.crossBorderQuestion')}</Text>
          <View accessibilityRole="radiogroup" style={styles.options}>
            <OptionCard
              title={t('household.crossBorderOneCountryTitle')}
              caption={t('household.crossBorderOneCountryCaption')}
              selected={!crossBorder}
              onPress={() => setCrossBorder(false)}
              selectedA11y={t('household.crossBorderSelected')}
            />
            <OptionCard
              title={t('household.crossBorderMultiTitle')}
              caption={t('household.crossBorderMultiCaption')}
              detail={t('household.crossBorderActivates')}
              selected={crossBorder}
              onPress={() => setCrossBorder(true)}
              selectedA11y={t('household.crossBorderSelected')}
            />
          </View>
          <Text variant="caption" muted>
            {t('household.crossBorderChangeNote')}
          </Text>
        </View>

        {formError ? (
          <Text variant="caption" style={{ color: palette.danger }}>
            {t(formError)}
          </Text>
        ) : null}

        <Button
          label={submitting ? t('auth.processing') : t('household.createCta')}
          onPress={onCreate}
          loading={submitting}
        />

        <Link href="/household/join" style={styles.joinLink}>
          <Text variant="caption" style={{ color: palette.brand }}>
            {t('household.joinInstead')}
          </Text>
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}

/** A radio-style card for the cross-border question. Selection is signalled by the
 *  brand fill/border AND a ✓ badge (never colour alone — F30). */
function OptionCard({
  title,
  caption,
  detail,
  selected,
  onPress,
  selectedA11y,
}: {
  title: string;
  caption: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
  selectedA11y: string;
}) {
  const cardStyles = useThemedStyles(makeCardStyles);
  const { palette } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={selected ? `${title}, ${selectedA11y}` : title}
      onPress={onPress}
      style={(state) => {
        const { pressed, hovered, focused } = state as WebPressableState;
        return [
          cardStyles.base,
          selected ? cardStyles.selected : cardStyles.unselected,
          hovered && !selected ? cardStyles.hovered : null,
          pressed ? cardStyles.pressed : null,
          focused ? webFocusRing : null,
        ];
      }}
    >
      <View style={cardStyles.textCol}>
        <Text variant="subheading">{title}</Text>
        <Text variant="caption" muted>
          {caption}
        </Text>
        {detail ? (
          <Text variant="caption" style={cardStyles.detail}>
            {detail}
          </Text>
        ) : null}
      </View>
      <View style={[cardStyles.check, selected ? cardStyles.checkOn : cardStyles.checkOff]}>
        {selected ? <Feather name="check" size={14} color={palette.white} /> : null}
      </View>
    </Pressable>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: FORM_MAX_WIDTH,
    alignSelf: 'center',
  },
  crossBorder: { gap: spacing.sm },
  options: { gap: spacing.sm },
  joinLink: { marginTop: spacing.sm, alignSelf: 'center' },
});

const makeCardStyles = (c: Palette) => StyleSheet.create({
  base: {
    flexDirection: direction.flexRow,
    alignItems: 'flex-start',
    gap: spacing.sm,
    minHeight: 44,
    padding: spacing.md,
    borderRadius: radius.lg,
    // 2px always so selection changes colour, never width (no reflow).
    borderWidth: 2,
  },
  unselected: { backgroundColor: c.surface, borderColor: c.border },
  selected: { backgroundColor: c.brandMuted, borderColor: c.brand },
  hovered: { backgroundColor: c.field },
  pressed: { opacity: 0.9 },
  textCol: { flex: 1, gap: 2 },
  detail: { color: c.textMuted, marginTop: 2 },
  check: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: c.brand },
  checkOff: { borderWidth: 2, borderColor: c.border },
});
