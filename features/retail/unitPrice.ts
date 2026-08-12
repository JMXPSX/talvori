/**
 * Unit-price normalization for cross-size comparison. Sizes normalize to a
 * canonical base (weight->gram, volume->millilitre, count->piece). The returned
 * per-base price is a float used ONLY for display/comparison — never persisted.
 */

export type BaseUnit = 'g' | 'ml' | 'piece';

// factor = how many base units one input unit equals
const UNIT_FACTORS: Readonly<Record<string, { base: BaseUnit; factor: number }>> = {
  mg: { base: 'g', factor: 0.001 },
  g: { base: 'g', factor: 1 },
  kg: { base: 'g', factor: 1000 },
  oz: { base: 'g', factor: 28.349523125 },
  lb: { base: 'g', factor: 453.59237 },
  ml: { base: 'ml', factor: 1 },
  l: { base: 'ml', factor: 1000 },
  floz: { base: 'ml', factor: 29.5735295625 },
  gal: { base: 'ml', factor: 3785.411784 },
  piece: { base: 'piece', factor: 1 },
  pc: { base: 'piece', factor: 1 },
  pcs: { base: 'piece', factor: 1 },
  pack: { base: 'piece', factor: 1 },
  ct: { base: 'piece', factor: 1 },
};

/** Total base-unit quantity for a size across the whole pack, or null. */
export function normalizeSize(
  sizeValue: number | null,
  sizeUnit: string | null,
  packCount: number,
): { base: number; unit: BaseUnit } | null {
  if (sizeValue == null || sizeUnit == null || !Number.isFinite(sizeValue) || sizeValue <= 0) {
    return null;
  }
  const key = sizeUnit.trim().toLowerCase().replace(/\s+/g, '');
  const entry = UNIT_FACTORS[key];
  if (!entry) return null;
  const count = Number.isFinite(packCount) && packCount > 0 ? packCount : 1;
  return { base: sizeValue * entry.factor * count, unit: entry.base };
}

/** Minor units per base unit (for comparison), or null if size is unknown. */
export function unitPriceMinor(
  priceMinor: number,
  sizeValue: number | null,
  sizeUnit: string | null,
  packCount: number,
): { perBaseMinor: number; unit: BaseUnit } | null {
  const size = normalizeSize(sizeValue, sizeUnit, packCount);
  if (!size || size.base <= 0) return null;
  return { perBaseMinor: priceMinor / size.base, unit: size.unit };
}
