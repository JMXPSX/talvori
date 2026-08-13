/** ListRow: navigation rows across Budget hub and More. */

import { fireEvent, render, screen } from '@testing-library/react-native';

import { ListRow } from '@/components/ui';

describe('<ListRow />', () => {
  it('renders label, sublabel, and detail', () => {
    render(<ListRow icon="users" label="Households" sublabel="2 members" detail="3" />);
    expect(screen.getByText('Households')).toBeOnTheScreen();
    expect(screen.getByText('2 members')).toBeOnTheScreen();
    expect(screen.getByText('3')).toBeOnTheScreen();
  });

  it('fires onPress', () => {
    const onPress = jest.fn();
    render(<ListRow icon="star" label="Subscription" onPress={onPress} />);
    fireEvent.press(screen.getByText('Subscription'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
