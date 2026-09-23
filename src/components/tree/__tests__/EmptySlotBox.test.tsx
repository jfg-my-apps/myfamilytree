import { fireEvent, render } from '@testing-library/react-native';
import { EmptySlotBox } from '../EmptySlotBox';

describe('EmptySlotBox', () => {
  it('calls onPress when tapped', async () => {
    const onPress = jest.fn();
    const slot = { personId: '1', role: 'parent' as const, x: 0, y: 0 };
    const { getByTestId } = await render(
      <EmptySlotBox slot={slot} label="+ Agregar padre" onPress={onPress} />
    );

    await fireEvent.press(getByTestId('empty-slot-1-parent'));
    expect(onPress).toHaveBeenCalled();
  });
});
