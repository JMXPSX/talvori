/** Zod schemas for the bills form. Amount is entered in major units and
 *  converted to minor units at the api boundary (in the account's currency). */

import { z } from 'zod';

export const billFrequencySchema = z.enum(['weekly', 'monthly', 'yearly']);
export const billDirectionSchema = z.enum(['in', 'out']);

export const billFormSchema = z.object({
  name: z.string().trim().min(1).max(80),
  direction: billDirectionSchema.default('out'),
  amountMajor: z.coerce.number().nonnegative(),
  frequency: billFrequencySchema.default('monthly'),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  notes: z.string().trim().max(200).optional(),
});
export type BillFormInput = z.infer<typeof billFormSchema>;
