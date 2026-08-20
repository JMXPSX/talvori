/**
 * Chip: the one shared selection chip (F30/F16). Asserts the a11y contract —
 * group role, selected state, and a NON-colour selection cue (the leading ✓
 * glyph) so selection is never communicated by colour alone.
 */

import { Feather } from '@expo/vector-icons';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { Chip } from '@/components/ui';

describe('<Chip />', () => {
  it('reports the radio role and selected state', () => {
    render(<Chip label="Cash" selected role="radio" />);
    const el = screen.getByRole('radio', { name: 'Cash' });
    expect(el.props.accessibilityState.selected).toBe(true);
  });

  it('reports the checkbox role for multi-select usage', () => {
    render(<Chip label="Groceries" role="checkbox" />);
    const el = screen.getByRole('checkbox', { name: 'Groceries' });
    expect(el.props.accessibilityState.selected).toBe(false);
  });

  it('shows a leading check glyph ONLY when selected (non-colour cue)', () => {
    const { rerender, UNSAFE_queryAllByType } = render(
      <Chip label="Cash" role="radio" selected={false} />,
    );
    expect(UNSAFE_queryAllByType(Feather)).toHaveLength(0);

    rerender(<Chip label="Cash" role="radio" selected />);
    expect(UNSAFE_queryAllByType(Feather)).toHaveLength(1);
  });

  it('fires onPress when tapped', () => {
    const onPress = jest.fn();
    render(<Chip label="Cash" role="radio" onPress={onPress} />);
    fireEvent.press(screen.getByText('Cash'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
