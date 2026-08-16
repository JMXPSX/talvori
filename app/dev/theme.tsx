/**
 * Dev-only design-system gallery. Renders every primitive in every state on one
 * page so the whole system can be reviewed at a glance — including the states
 * that are painful to reach by hand (focus, error, empty, over-budget) and the
 * Arabic faces, which only appear when the UI language is Arabic.
 *
 * `__DEV__`-gated like the 6a plan toggle in app/subscription.tsx: it renders
 * nothing in a production build, so it can never ship as a real route.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { chartSeries, palette, radius, spacing, typography } from '@/components/theme';
import {
  Button,
  Card,
  Donut,
  EmptyState,
  ErrorNotice,
  ListRow,
  ProgressBar,
  Text,
  TextField,
  useActionSheet,
} from '@/components/ui';
import { isArabicLanguage } from '@/lib/fonts';

const SWATCHES: { name: string; value: string }[] = Object.entries(palette).map(([name, value]) => ({
  name,
  value,
}));

const VARIANTS = Object.keys(typography) as (keyof typeof typography)[];

/** Pangram-ish sample per script, so the faces can be compared directly. */
const SAMPLE = { latin: 'Household balance 1,234.56', arabic: 'رصيد الأسرة ١٢٣٤٫٥٦' };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="eyebrow" muted>
        {title}
      </Text>
      {children}
    </View>
  );
}

export default function ThemeGalleryScreen() {
  const { i18n } = useTranslation();
  const isArabic = isArabicLanguage(i18n.language);
  const [field, setField] = useState('');
  const sheet = useActionSheet();

  if (!__DEV__) return null;

  const donutSegments = chartSeries.slice(0, 5).map((color, i, arr) => ({
    color,
    fraction: 1 / arr.length,
    offset: i / arr.length,
  }));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="title">Design system</Text>
        <Text variant="caption" muted>
          {isArabic ? 'Arabic — Readex Pro' : 'Latin — Plus Jakarta Sans'}
        </Text>
        <Button
          label={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}
          variant="secondary"
          onPress={() => void i18n.changeLanguage(isArabic ? 'en' : 'ar')}
        />

        <Section title="Typography">
          <Card>
            {VARIANTS.map((v) => (
              <View key={v} style={styles.typeRow}>
                <Text variant="caption" muted style={styles.typeName}>
                  {v}
                </Text>
                <Text variant={v} style={styles.typeSample}>
                  {isArabic ? SAMPLE.arabic : SAMPLE.latin}
                </Text>
              </View>
            ))}
          </Card>
        </Section>

        <Section title="Palette">
          <Card>
            <View style={styles.swatches}>
              {SWATCHES.map((s) => (
                <View key={s.name} style={styles.swatch}>
                  <View style={[styles.chip, { backgroundColor: s.value }]} />
                  <Text variant="caption" muted numberOfLines={1}>
                    {s.name}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        </Section>

        <Section title="Buttons">
          <Card>
            <Button label="Primary" onPress={() => undefined} />
            <Button label="Secondary" variant="secondary" onPress={() => undefined} />
            <Button label="Accent" variant="accent" onPress={() => undefined} />
            <Button label="Disabled" disabled onPress={() => undefined} />
            <Button label="Loading" loading onPress={() => undefined} />
          </Card>
        </Section>

        <Section title="Fields">
          <Card>
            <TextField label="Idle" value={field} onChangeText={setField} placeholder="Tap to focus" />
            <TextField label="With hint" value="" onChangeText={() => undefined} hint="Helper text" />
            <TextField label="Error" value="nope" onChangeText={() => undefined} error="Something is wrong" />
            <TextField label="Disabled" value="Read only" onChangeText={() => undefined} editable={false} />
          </Card>
        </Section>

        <Section title="Cards">
          <Card>
            <Text variant="heading">Default tile</Text>
            <Text muted>Borderless, ambient shadow, 24px padding.</Text>
          </Card>
          <Card accented>
            <Text variant="heading">Accented tile</Text>
            <Text muted>Tinted surface — the highlighted item.</Text>
          </Card>
        </Section>

        <Section title="Rows">
          <ListRow icon="credit-card" label="Accounts" sublabel="4 open" detail="USD" onPress={() => undefined} />
          <ListRow icon="globe" label="Language" detail="English" onPress={() => undefined} />
        </Section>

        <Section title="Meters">
          <Card>
            <Text variant="caption" muted>normal 45%</Text>
            <ProgressBar fraction={0.45} />
            <Text variant="caption" muted>full 100%</Text>
            <ProgressBar fraction={1} state="full" />
            <Text variant="caption" muted>over 120%</Text>
            <ProgressBar fraction={1} state="over" />
          </Card>
        </Section>

        <Section title="Chart series">
          <Card>
            <View style={styles.donutRow}>
              <Donut segments={donutSegments} size={140} stroke={20} />
              <View style={styles.legend}>
                {chartSeries.map((c, i) => (
                  <View key={c} style={styles.legendRow}>
                    <View style={[styles.dot, { backgroundColor: c }]} />
                    <Text variant="caption" muted>
                      series {i + 1}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </Card>
        </Section>

        <Section title="Feedback">
          <ErrorNotice
            message="Could not reach the server."
            retryLabel="Retry"
            onRetry={() => undefined}
          />
          <Card>
            <EmptyState icon="inbox" message="Nothing here yet." ctaLabel="Add one" onCta={() => undefined} />
          </Card>
          <Button
            label="Open action sheet"
            variant="secondary"
            onPress={() =>
              sheet.show({
                title: 'Delete this budget?',
                message: 'Its transactions stay, but the budget is removed.',
                cancelLabel: 'Cancel',
                actions: [{ label: 'Delete', destructive: true, onPress: () => undefined }],
              })
            }
          />
        </Section>
        {sheet.element}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  section: { gap: spacing.sm },
  typeRow: { gap: 2, paddingVertical: spacing.xs },
  typeName: { opacity: 0.6 },
  typeSample: {},
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: { width: 72, gap: spacing.xs },
  chip: { height: 40, borderRadius: radius.control, borderWidth: 1, borderColor: palette.border },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  legend: { flex: 1, gap: spacing.xs },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: radius.pill },
});
