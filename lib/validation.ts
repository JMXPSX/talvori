/**
 * Validation organization pattern (see 09_PHASE_1_CLAUDE_BUILD_PROMPT.md §L).
 *
 * Convention for the whole app:
 *   - Every feature owns its schemas under `features/<name>/schemas.ts`.
 *   - Parse untrusted input (form values, API payloads, deep-link params) with
 *     Zod at the boundary; downstream code receives typed, validated data.
 *   - Use `parseOrThrow` so failures become a consistent `AppError('validation')`
 *     that the UI can render via i18n instead of leaking Zod internals.
 */

import { z } from 'zod';

import { AppError } from '@/lib/errors';

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: AppError; fieldErrors: Record<string, string[]> };

/** Safe parse that never throws; ideal for form validation with field errors. */
export function validate<T>(schema: z.ZodType<T>, input: unknown): ValidationResult<T> {
  const result = schema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const flattened = result.error.flatten();
  return {
    success: false,
    error: new AppError('validation', {
      messageKey: 'errors.validation',
      cause: result.error,
    }),
    fieldErrors: flattened.fieldErrors as Record<string, string[]>,
  };
}

/** Parse-or-throw for non-form boundaries (deep links, config, API responses). */
export function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError('validation', {
      messageKey: 'errors.validation',
      cause: result.error,
    });
  }
  return result.data;
}

/** Shared primitives features can compose. Expand as domains are built. */
export const commonSchemas = {
  email: z.string().trim().min(1).email(),
  /** ISO 4217 currency code, uppercased. */
  currencyCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/)
    .transform((v) => v.toUpperCase()),
  /** Integer minor units — never a float (see lib/money.ts). */
  amountMinor: z.number().int(),
} as const;
