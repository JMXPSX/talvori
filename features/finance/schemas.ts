/**
 * Finance form schemas. Amounts are entered in MAJOR units (what the user types,
 * e.g. "25.99") and converted to integer minor units via lib/money.ts before
 * they ever touch the database. Never persist the major-unit float.
 */

import { z } from 'zod';

export const accountTypeSchema = z.enum(['cash', 'bank', 'card', 'wallet', 'other']);

export const createAccountSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: accountTypeSchema.default('cash'),
  currencyCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/)
    .transform((v) => v.toUpperCase()),
  openingBalanceMajor: z.coerce.number().finite().default(0),
});
export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const editAccountSchema = z.object({
  name: z.string().trim().min(1).max(80),
  openingBalanceMajor: z.coerce.number().finite().default(0),
});
export type EditAccountInput = z.infer<typeof editAccountSchema>;

export const createEntrySchema = z.object({
  accountId: z.string().uuid(),
  type: z.enum(['income', 'expense']),
  amountMajor: z.coerce.number().positive(),
  categoryId: z.string().uuid().optional(),
  description: z.string().trim().max(200).optional(),
});
export type CreateEntryInput = z.infer<typeof createEntrySchema>;

export const createTransferSchema = z
  .object({
    fromAccountId: z.string().uuid(),
    toAccountId: z.string().uuid(),
    fromAmountMajor: z.coerce.number().positive(),
    toAmountMajor: z.coerce.number().positive(),
    description: z.string().trim().max(200).optional(),
  })
  .refine((d) => d.fromAccountId !== d.toAccountId, {
    message: 'accounts must differ',
    path: ['toAccountId'],
  });
export type CreateTransferInput = z.infer<typeof createTransferSchema>;

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(60),
  kind: z.enum(['income', 'expense']),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
