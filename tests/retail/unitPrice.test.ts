import { normalizeSize, unitPriceMinor } from '@/features/retail/unitPrice';

describe('normalizeSize', () => {
  it('converts kg to grams times pack count', () => {
    expect(normalizeSize(1.5, 'kg', 2)).toEqual({ base: 3000, unit: 'g' });
  });
  it('converts litres to millilitres', () => {
    expect(normalizeSize(2, 'L', 1)).toEqual({ base: 2000, unit: 'ml' });
  });
  it('treats pieces as count', () => {
    expect(normalizeSize(6, 'piece', 1)).toEqual({ base: 6, unit: 'piece' });
  });
  it('returns null for unknown units', () => {
    expect(normalizeSize(1, 'furlong', 1)).toBeNull();
  });
  it('returns null when size is missing', () => {
    expect(normalizeSize(null, 'kg', 1)).toBeNull();
  });
});

describe('unitPriceMinor', () => {
  it('computes price per base unit', () => {
    // 500 minor for 1kg (=1000g) => 0.5 minor per gram
    expect(unitPriceMinor(500, 1, 'kg', 1)).toEqual({ perBaseMinor: 0.5, unit: 'g' });
  });
  it('accounts for pack count', () => {
    // 1200 minor for 2 x 500ml (=1000ml) => 1.2 minor per ml
    expect(unitPriceMinor(1200, 500, 'ml', 2)).toEqual({ perBaseMinor: 1.2, unit: 'ml' });
  });
  it('returns null when size cannot be normalized', () => {
    expect(unitPriceMinor(500, null, 'kg', 1)).toBeNull();
  });
});
