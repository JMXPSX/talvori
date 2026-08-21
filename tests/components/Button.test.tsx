/**
 * Component-testing smoke test — proves the jest-expo + Testing Library render
 * pipeline works for React Native components.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '@/components/ui';

describe('<Button />', () => {
  it('renders its label', () => {
    render(<Button label="Sign in" />);
    expect(screen.getByText('Sign in')).toBeOnTheScreen();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    render(<Button label="Continue" onPress={onPress} />);
    fireEvent.press(screen.getByText('Continue'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress while disabled', () => {
    const onPress = jest.fn();
    render(<Button label="Blocked" onPress={onPress} disabled />);
    fireEvent.press(screen.getByText('Blocked'));
    expect(onPress).not.toHaveBeenCalled();
  });

  // F17: destructive variants replace ad-hoc red style overrides.
  it('renders and fires the filled danger variant (used inside confirms)', () => {
    const onPress = jest.fn();
    render(<Button label="Delete" variant="danger" onPress={onPress} />);
    const el = screen.getByText('Delete');
    expect(el).toBeOnTheScreen();
    fireEvent.press(el);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders and fires the text-only dangerQuiet variant', () => {
    const onPress = jest.fn();
    render(<Button label="Delete list" variant="dangerQuiet" onPress={onPress} />);
    const el = screen.getByText('Delete list');
    expect(el).toBeOnTheScreen();
    fireEvent.press(el);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
