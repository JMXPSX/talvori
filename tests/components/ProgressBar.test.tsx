/** ProgressBar: budget meters live on this — clamp + a11y value must hold. */

import { render, screen } from '@testing-library/react-native';

import { ProgressBar } from '@/components/ui';

function a11yValue() {
  return screen.getByRole('progressbar').props.accessibilityValue;
}

describe('<ProgressBar />', () => {
  it('exposes the fraction through the accessibility value', () => {
    render(<ProgressBar fraction={0.4} />);
    expect(a11yValue()).toEqual({ min: 0, max: 1, now: 0.4 });
  });

  it('clamps overshoot to 1 (over-budget renders full)', () => {
    render(<ProgressBar fraction={1.75} state="over" />);
    expect(a11yValue().now).toBe(1);
  });

  it('clamps negative fractions to 0', () => {
    render(<ProgressBar fraction={-0.3} />);
    expect(a11yValue().now).toBe(0);
  });
});
