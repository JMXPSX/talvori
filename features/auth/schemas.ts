/**
 * Auth form schemas (see lib/validation.ts for the pattern). Validated at the
 * screen boundary before any network call.
 */

import { z } from 'zod';

/** Minimum password length. Kept modest here; step-up/MFA comes later (Phase 2+). */
export const MIN_PASSWORD_LENGTH = 8;

export const loginSchema = z.object({
  email: z.string().trim().min(1).email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  displayName: z.string().trim().max(80).optional(),
  email: z.string().trim().min(1).email(),
  password: z.string().min(MIN_PASSWORD_LENGTH),
});
export type SignupInput = z.infer<typeof signupSchema>;
