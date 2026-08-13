/**
 * Plan definitions + resolution (pure). The plan->capabilities map is the single
 * place gates are assigned. `resolvePlan` turns a subscription row (from any
 * source: manual now, apple/google/stripe later) into the effective plan.
 */

export type PlanCode = 'free' | 'premium';

// Boolean feature capabilities that are actually enforced by gates. Metering-style
// perks (multiple households, unlimited savings goals) need numeric limits and are
// deferred to a future metering slice — not listed here so Premium never advertises
// what it can't yet deliver.
export type Capability = 'multi_currency_dashboard' | 'retail_comparison' | 'coupons';

const ALL_CAPABILITIES: Capability[] = [
  'multi_currency_dashboard',
  'retail_comparison',
  'coupons',
];

export const PLAN_CAPABILITIES: Record<PlanCode, Capability[]> = {
  free: [],
  premium: ALL_CAPABILITIES,
};

export function planIncludes(plan: PlanCode, cap: Capability): boolean {
  return PLAN_CAPABILITIES[plan].includes(cap);
}

interface SubscriptionLike {
  plan_code: PlanCode;
  status: string;
  current_period_end: string | null;
}

/** Effective plan for a subscription row (or null). Missing/expired/canceled = free. */
export function resolvePlan(sub: SubscriptionLike | null, nowMs: number): PlanCode {
  if (!sub) return 'free';
  if (sub.status !== 'active') return 'free';
  if (sub.current_period_end != null && new Date(sub.current_period_end).getTime() < nowMs) {
    return 'free';
  }
  return sub.plan_code;
}
