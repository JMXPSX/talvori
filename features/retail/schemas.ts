/**
 * Retail form validation. Prices entered in MAJOR units; converted to minor at
 * the screen boundary (lib/money.toMinorUnits). Currency codes upper-cased.
 */

import { z } from 'zod';

const name = z.string().trim().min(1).max(120);
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));
const country = z
  .string()
  .trim()
  .toUpperCase()
  .refine((s) => s === '' || /^[A-Z]{2}$/.test(s), { message: 'invalid_country' })
  .optional()
  .transform((v) => (v ? v : undefined));
const currency = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase())
  .refine((s) => /^[A-Z]{3}$/.test(s), { message: 'invalid_currency' });
const optionalMajor = z
  .union([z.number(), z.string()])
  .optional()
  .transform((v) => (v === undefined || v === '' ? undefined : Number(v)))
  .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), { message: 'invalid_amount' });
const optionalNumber = z
  .union([z.number(), z.string()])
  .optional()
  .transform((v) => (v === undefined || v === '' ? undefined : Number(v)))
  .refine((v) => v === undefined || Number.isFinite(v), { message: 'invalid_number' });

export const createRetailerSchema = z.object({
  name,
  countryCode: country,
  website: optionalText(200),
  notes: optionalText(500),
});

export const createStoreSchema = z.object({
  name,
  street: optionalText(200),
  city: optionalText(120),
  region: optionalText(120),
  postalCode: optionalText(20),
  countryCode: country,
  latitude: optionalNumber,
  longitude: optionalNumber,
  currencyCode: currency,
  isOnline: z.boolean().optional(),
});

export const createProductSchema = z.object({
  name,
  brand: optionalText(120),
  gtin: optionalText(20),
  upc: optionalText(20),
  ean: optionalText(20),
  sizeValue: optionalNumber,
  sizeUnit: optionalText(24),
  packCount: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => (v === undefined || v === '' ? 1 : Number(v)))
    .refine((v) => Number.isInteger(v) && v > 0, { message: 'invalid_pack' }),
  category: optionalText(80),
});

export const createRetailerProductSchema = z.object({
  productId: z.string().uuid(),
  retailerId: z.string().uuid(),
  retailerSku: optionalText(80),
  displayName: optionalText(120),
});

export const createPriceSchema = z.object({
  retailerProductId: z.string().uuid(),
  storeId: z.string().uuid().optional(),
  regularMajor: z
    .union([z.number(), z.string()])
    .transform((v) => Number(v))
    .refine((v) => Number.isFinite(v) && v >= 0, { message: 'invalid_amount' }),
  saleMajor: optionalMajor,
  memberMajor: optionalMajor,
  currencyCode: currency,
});

export const createSavedLocationSchema = z.object({
  label: name,
  storeId: z.string().uuid(),
});

export type CreateRetailerInput = z.infer<typeof createRetailerSchema>;
export type CreateStoreInput = z.infer<typeof createStoreSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type CreateRetailerProductInput = z.infer<typeof createRetailerProductSchema>;
export type CreatePriceInput = z.infer<typeof createPriceSchema>;
export type CreateSavedLocationInput = z.infer<typeof createSavedLocationSchema>;
