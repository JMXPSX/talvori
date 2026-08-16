import { WIDE_LAYOUT_MIN_WIDTH, isWideLayout } from '@/lib/breakpoints';

describe('isWideLayout', () => {
  it('is false for phone widths', () => {
    expect(isWideLayout(375)).toBe(false); // iPhone portrait
    expect(isWideLayout(414)).toBe(false);
  });

  it('is false for tablet portrait, which keeps the bottom tabs', () => {
    expect(isWideLayout(768)).toBe(false);
    expect(isWideLayout(1023)).toBe(false);
  });

  it('is true from the breakpoint upward', () => {
    expect(isWideLayout(WIDE_LAYOUT_MIN_WIDTH)).toBe(true);
    expect(isWideLayout(1280)).toBe(true);
    expect(isWideLayout(1920)).toBe(true);
  });

  it('treats the breakpoint as inclusive', () => {
    expect(isWideLayout(WIDE_LAYOUT_MIN_WIDTH - 1)).toBe(false);
    expect(isWideLayout(WIDE_LAYOUT_MIN_WIDTH)).toBe(true);
  });
});
