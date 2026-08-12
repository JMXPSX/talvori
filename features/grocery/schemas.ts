/**
 * Grocery form validation. Prices are entered in MAJOR units here and converted
 * to integer minor units at the screen boundary (see lib/money.toMinorUnits).
 */

import { z } from 'zod';

const currency = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase())
  .refine((s) => /^[A-Z]{3}$/.test(s), { message: 'invalid_currency' });

const name = z.string().trim().min(1).max(120);
const optionalMajor = z
  .union([z.number(), z.string()])
  .optional()
  .transform((v) => (v === undefined || v === '' ? undefined : Number(v)))
  .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), {
    message: 'invalid_amount',
  });

export const createListSchema = z.object({
  name,
  currencyCode: currency,
});

export const addItemSchema = z.object({
  name,
  quantity: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => (v === undefined || v === '' ? 1 : Number(v)))
    .refine((v) => Number.isFinite(v) && v > 0, { message: 'invalid_quantity' }),
  unit: z.string().trim().max(24).optional().transform((v) => (v ? v : undefined)),
  estimatedMajor: optionalMajor,
});

export const updateItemSchema = z.object({
  name: name.optional(),
  quantity: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => (v === undefined || v === '' ? undefined : Number(v)))
    .refine((v) => v === undefined || (Number.isFinite(v) && v > 0), {
      message: 'invalid_quantity',
    }),
  unit: z.string().trim().max(24).optional(),
  estimatedMajor: optionalMajor,
  actualMajor: optionalMajor,
  isPurchased: z.boolean().optional(),
});

export const checkoutSchema = z.object({
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
});

export type CreateListInput = z.infer<typeof createListSchema>;
export type AddItemInput = z.infer<typeof addItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
