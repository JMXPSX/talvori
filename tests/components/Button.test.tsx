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
});
