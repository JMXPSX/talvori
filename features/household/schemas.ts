/**
 * Household form schemas. Validated at the screen boundary (see lib/validation).
 */

import { z } from 'zod';

export const householdRoleSchema = z.enum(['owner', 'admin', 'member', 'viewer']);

/** Roles a user may be invited as (never 'owner' — ownership transfers explicitly). */
export const invitableRoleSchema = z.enum(['admin', 'member', 'viewer']);

export const createHouseholdSchema = z.object({
  name: z.string().trim().min(1).max(80),
  reportingCurrencyCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/)
    .transform((v) => v.toUpperCase()),
  isCrossBorder: z.boolean().default(false),
});
export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().trim().min(1).email(),
  role: invitableRoleSchema.default('member'),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const acceptInvitationSchema = z.object({
  token: z.string().trim().uuid(),
});
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
