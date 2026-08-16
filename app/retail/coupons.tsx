/** Coupons discovery: active/expired sections + add coupon (fixed or percent). */

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { elevation, palette, radius, spacing } from '@/components/theme';
import { Button, CONTENT_MAX_WIDTH, Text, TextField } from '@/components/ui';
import { listRetailers } from '@/features/retail/api';
import { couponStatus } from '@/features/retail/coupon';
import { createCoupon, deleteCoupon, listCoupons } from '@/features/retail/couponApi';
import type { CouponWithRefs } from '@/features/retail/couponApi';
import { createCouponSchema } from '@/features/retail/schemas';
import { usePlan } from '@/features/billing/EntitlementsProvider';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { RetailerRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';
import { toMinorUnits } from '@/lib/money';
import { validate } from '@/lib/validation';

export default function CouponsScreen() {
  const { t } = useTranslation();
  const { active } = useActiveHousehold();
  const { has } = usePlan();
  const router = useRouter();

  const [coupons, setCoupons] = useState<CouponWithRefs[]>([]);
  // Expiry reference time, captured when coupons load (render must stay pure).
  const [now, setNow] = useState(0);
  const [retailers, setRetailers] = useState<RetailerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [retailerId, setRetailerId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'fixed' | 'percent'>('fixed');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(active?.reporting_currency_code ?? '');
  const [percent, setPercent] = useState('');
  const [minPurchase, setMinPurchase] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [code, setCode] = useState('');
  const [url, setUrl] = useState('');
  const [expires, setExpires] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      const [cs, rs] = await Promise.all([listCoupons(active.id), listRetailers(active.id)]);
      setNow(Date.now());
      setCoupons(cs);
      setRetailers(rs);
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [active]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onAdd() {
    if (!active || !retailerId) {
      setErrorKey('coupons.errors.saveFailed');
      return;
    }
    const result = validate(createCouponSchema, {
      retailerId,
      title,
      code,
      sourceUrl: url,
      discountType: type,
      amountMajor: type === 'fixed' ? amount : undefined,
      currencyCode: type === 'fixed' ? currency : undefined,
      percent: type === 'percent' ? percent : undefined,
      minPurchaseMajor: minPurchase,
      maxDiscountMajor: maxDiscount,
      expiresAt: expires,
    });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    const ccy = type === 'fixed' ? (result.data.currencyCode as string) : active.reporting_currency_code;
    setSubmitting(true);
    try {
      await createCoupon(active.id, {
        retailerId: result.data.retailerId,
        title: result.data.title,
        code: result.data.code,
        sourceUrl: result.data.sourceUrl,
        discountType: result.data.discountType,
        discountAmountMinor:
          result.data.discountType === 'fixed' && result.data.amountMajor !== undefined
            ? toMinorUnits(result.data.amountMajor, ccy)
            : undefined,
        currencyCode: result.data.discountType === 'fixed' ? result.data.currencyCode : undefined,
        discountPercent: result.data.discountType === 'percent' ? result.data.percent : undefined,
        minPurchaseMinor:
          result.data.minPurchaseMajor === undefined ? undefined : toMinorUnits(result.data.minPurchaseMajor, ccy),
        maxDiscountMinor:
          result.data.maxDiscountMajor === undefined ? undefined : toMinorUnits(result.data.maxDiscountMajor, ccy),
        expiresAt: result.data.expiresAt ? new Date(result.data.expiresAt).toISOString() : undefined,
      });
      setTitle(''); setAmount(''); setPercent(''); setMinPurchase(''); setMaxDiscount('');
      setCode(''); setUrl(''); setExpires('');
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteCoupon(id);
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }

  if (!has('coupons')) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.card}>
            <Text variant="heading">{t('billing.lockedTitle')}</Text>
            <Text muted>{t('billing.lockedBody')}</Text>
            <Button label={t('billing.manageCta')} onPress={() => router.push('/subscription')} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const activeCoupons = coupons.filter((c) => couponStatus(c, now) !== 'expired');
  const expiredCoupons = coupons.filter((c) => couponStatus(c, now) === 'expired');

  function describe(c: CouponWithRefs): string {
    if (c.discount_type === 'fixed' && c.discount_amount_minor != null && c.currency_code) {
      return formatAmount(c.discount_amount_minor, c.currency_code);
    }
    return `${c.discount_percent ?? 0}%`;
  }

  function renderCoupon(c: CouponWithRefs) {
    return (
      <View key={c.id} style={styles.card}>
        <View style={styles.cardRow}>
          <Text variant="heading">{c.title}</Text>
          <Text variant="heading">{describe(c)}</Text>
        </View>
        <Text variant="caption" muted>
          {c.retailer?.name ?? '—'}
          {c.retailer_product?.display_name ? ` · ${c.retailer_product.display_name}` : ''}
          {c.code ? ` · ${c.code}` : ''}
        </Text>
        <View style={styles.cardRow}>
          {c.source_url ? (
            <Pressable onPress={() => void Linking.openURL(c.source_url as string)}>
              <Text variant="caption" style={{ color: palette.brand }}>{t('coupons.openLink')}</Text>
            </Pressable>
          ) : <View />}
          <Pressable onPress={() => onDelete(c.id)}>
            <Text variant="caption" style={{ color: palette.danger }}>{t('coupons.delete')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {errorKey ? <Text style={{ color: palette.danger }}>{t(errorKey)}</Text> : null}

        {loading ? (
          <ActivityIndicator color={palette.brand} />
        ) : coupons.length === 0 ? (
          <Text muted>{t('coupons.empty')}</Text>
        ) : (
          <View style={styles.list}>
            {activeCoupons.length > 0 && (
              <>
                <Text variant="caption" muted>{t('coupons.active')}</Text>
                {activeCoupons.map(renderCoupon)}
              </>
            )}
            {expiredCoupons.length > 0 && (
              <>
                <Text variant="caption" muted>{t('coupons.expired')}</Text>
                {expiredCoupons.map(renderCoupon)}
              </>
            )}
          </View>
        )}

        <View style={styles.divider} />
        <Text variant="heading">{t('coupons.addTitle')}</Text>
        <View style={styles.form}>
          <Text variant="caption" muted>{t('coupons.chooseRetailer')}</Text>
          <View style={styles.chips}>
            {retailers.map((r) => {
              const on = r.id === retailerId;
              return (
                <Pressable key={r.id} onPress={() => setRetailerId(r.id)}
                  style={[styles.chip, on ? styles.chipActive : null]}>
                  <Text variant="caption" style={{ color: on ? palette.white : palette.text }}>{r.name}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextField label={t('coupons.couponTitle')} value={title} onChangeText={setTitle}
            autoCapitalize="sentences" error={fieldErrors.title ? t('errors.validation') : undefined} />

          <Text variant="caption" muted>{t('coupons.discountType')}</Text>
          <View style={styles.chips}>
            <Pressable onPress={() => setType('fixed')} style={[styles.chip, type === 'fixed' ? styles.chipActive : null]}>
              <Text variant="caption" style={{ color: type === 'fixed' ? palette.white : palette.text }}>{t('coupons.fixed')}</Text>
            </Pressable>
            <Pressable onPress={() => setType('percent')} style={[styles.chip, type === 'percent' ? styles.chipActive : null]}>
              <Text variant="caption" style={{ color: type === 'percent' ? palette.white : palette.text }}>{t('coupons.percent')}</Text>
            </Pressable>
          </View>

          {type === 'fixed' ? (
            <>
              <TextField label={t('coupons.amount')} value={amount} onChangeText={setAmount} keyboardType="numeric"
                error={fieldErrors.amountMajor ? t('errors.validation') : undefined} />
              <TextField label={t('coupons.currency')} value={currency} onChangeText={setCurrency}
                autoCapitalize="characters" error={fieldErrors.currencyCode ? t('errors.validation') : undefined} />
            </>
          ) : (
            <TextField label={t('coupons.percentValue')} value={percent} onChangeText={setPercent} keyboardType="numeric"
              error={fieldErrors.percent ? t('errors.validation') : undefined} />
          )}

          <TextField label={t('coupons.minPurchase')} value={minPurchase} onChangeText={setMinPurchase} keyboardType="numeric" />
          <TextField label={t('coupons.maxDiscount')} value={maxDiscount} onChangeText={setMaxDiscount} keyboardType="numeric" />
          <TextField label={t('coupons.code')} value={code} onChangeText={setCode} />
          <TextField label={t('coupons.sourceUrl')} value={url} onChangeText={setUrl} autoCapitalize="none" />
          <TextField label={t('coupons.expiresAt')} value={expires} onChangeText={setExpires} autoCapitalize="none" />
          <Button label={submitting ? t('auth.processing') : t('coupons.addCta')} onPress={onAdd} loading={submitting} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    // Cap + centre so the screen does not stretch edge to edge on a monitor.
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  list: { gap: spacing.sm },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
    boxShadow: elevation.tile, gap: spacing.xs,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill, backgroundColor: palette.field,
  },
  chipActive: { backgroundColor: palette.brand },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
  form: { gap: spacing.sm },
});
