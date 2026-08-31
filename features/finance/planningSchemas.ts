/**
 * Budget / goal / debt form schemas. Amounts entered in MAJOR units and
 * converted to minor units (lib/money) before persisting. Dates are ISO
 * calendar dates (YYYY-MM-DD).
 */

import { z } from 'zod';

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/);

const currency = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/)
  .transform((v) => v.toUpperCase());

export const createBudgetSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    currencyCode: currency,
    periodStart: isoDate,
    periodEnd: isoDate,
  })
  .refine((d) => d.periodEnd >= d.periodStart, {
    message: 'period end before start',
    path: ['periodEnd'],
  });
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;

export const addAllocationSchema = z.object({
  categoryId: z.string().uuid().optional(),
  limitMajor: z.coerce.number().nonnegative(),
  // Money-model #3: every allocation names its funding account.
  accountId: z.string().uuid(),
});
export type AddAllocationInput = z.infer<typeof addAllocationSchema>;

export const createGoalSchema = z.object({
  name: z.string().trim().min(1).max(80),
  currencyCode: currency,
  targetMajor: z.coerce.number().positive(),
  targetDate: isoDate.optional(),
});
export type CreateGoalInput = z.infer<typeof createGoalSchema>;

export const contributeSchema = z.object({
  amountMajor: z.coerce.number().positive(),
  note: z.string().trim().max(200).optional(),
});
export type ContributeInput = z.infer<typeof contributeSchema>;

export const createDebtSchema = z.object({
  name: z.string().trim().min(1).max(80),
  currencyCode: currency,
  principalMajor: z.coerce.number().nonnegative(),
  apr: z.coerce.number().nonnegative().optional(),
  dueDay: z.coerce.number().int().min(1).max(31).optional(),
});
export type CreateDebtInput = z.infer<typeof createDebtSchema>;

export const payDebtSchema = z.object({
  amountMajor: z.coerce.number().positive(),
  note: z.string().trim().max(200).optional(),
});
export type PayDebtInput = z.infer<typeof payDebtSchema>;

export const createRateSchema = z
  .object({
    baseCurrency: currency,
    quoteCurrency: currency,
    rate: z.coerce.number().positive(),
  })
  .refine((d) => d.baseCurrency !== d.quoteCurrency, {
    message: 'currencies must differ',
    path: ['quoteCurrency'],
  });
export type CreateRateInput = z.infer<typeof createRateSchema>;
