import { PLAN_CAPABILITIES, planIncludes, resolvePlan } from '@/features/billing/plans';

const DAY = 24 * 3600 * 1000;
const now = 1_000 * DAY;
const iso = (ms: number) => new Date(ms).toISOString();

describe('planIncludes', () => {
  it('premium includes retail_comparison; free does not', () => {
    expect(planIncludes('premium', 'retail_comparison')).toBe(true);
    expect(planIncludes('free', 'retail_comparison')).toBe(false);
  });
  it('free grants no capabilities', () => {
    expect(PLAN_CAPABILITIES.free).toEqual([]);
  });
});

describe('resolvePlan', () => {
  it('treats no subscription as free', () => {
    expect(resolvePlan(null, now)).toBe('free');
  });
  it('treats a canceled subscription as free', () => {
    expect(resolvePlan({ plan_code: 'premium', status: 'canceled', current_period_end: null }, now)).toBe('free');
  });
  it('treats an expired premium as free', () => {
    expect(resolvePlan({ plan_code: 'premium', status: 'active', current_period_end: iso(now - DAY) }, now)).toBe('free');
  });
  it('honors an active premium with no expiry', () => {
    expect(resolvePlan({ plan_code: 'premium', status: 'active', current_period_end: null }, now)).toBe('premium');
  });
  it('honors an active premium not yet expired', () => {
    expect(resolvePlan({ plan_code: 'premium', status: 'active', current_period_end: iso(now + DAY) }, now)).toBe('premium');
  });
  it('returns free for an active free plan', () => {
    expect(resolvePlan({ plan_code: 'free', status: 'active', current_period_end: null }, now)).toBe('free');
  });
});
