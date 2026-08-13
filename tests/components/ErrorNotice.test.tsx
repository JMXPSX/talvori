/** ErrorNotice: the retry affordance for data-screen failures (Phase 8 QA 4). */

import { fireEvent, render, screen } from '@testing-library/react-native';

import { ErrorNotice } from '@/components/ui';

describe('<ErrorNotice />', () => {
  it('renders the message and fires onRetry', () => {
    const onRetry = jest.fn();
    render(<ErrorNotice message="Network problem." retryLabel="Retry" onRetry={onRetry} />);
    expect(screen.getByText('Network problem.')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('omits the retry button when no handler is given', () => {
    render(<ErrorNotice message="Broken." retryLabel="Retry" />);
    expect(screen.queryByText('Retry')).toBeNull();
  });
});
