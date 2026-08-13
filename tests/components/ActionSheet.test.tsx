/** ActionSheetDialog: the web fallback for Alert.alert-style choosers. */

import { fireEvent, render, screen } from '@testing-library/react-native';

import { ActionSheetDialog } from '@/components/ui';

function setup(overrides: { destructive?: boolean } = {}) {
  const onPress = jest.fn();
  const onClose = jest.fn();
  render(
    <ActionSheetDialog
      title="New transaction"
      message="Pick a type"
      cancelLabel="Cancel"
      onClose={onClose}
      actions={[{ label: 'Add income', destructive: overrides.destructive, onPress }]}
    />,
  );
  return { onPress, onClose };
}

describe('<ActionSheetDialog />', () => {
  it('renders title, message, actions, and cancel', () => {
    setup();
    expect(screen.getByText('New transaction')).toBeOnTheScreen();
    expect(screen.getByText('Pick a type')).toBeOnTheScreen();
    expect(screen.getByText('Add income')).toBeOnTheScreen();
    expect(screen.getByText('Cancel')).toBeOnTheScreen();
  });

  it('closes then fires the action when an action row is pressed', () => {
    const { onPress, onClose } = setup();
    fireEvent.press(screen.getByText('Add income'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('only closes when cancel is pressed', () => {
    const { onPress, onClose } = setup();
    fireEvent.press(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });
});
