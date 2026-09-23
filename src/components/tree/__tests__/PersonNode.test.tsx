import { fireEvent, render } from '@testing-library/react-native';
import { PersonNode } from '../PersonNode';

describe('PersonNode', () => {
  it('calls onPress when tapped', async () => {
    const onPress = jest.fn();
    const person = { id: '1', fullName: 'Mamá', isLiving: true, birthDate: null, deathDate: null };
    const { getByTestId } = await render(
      <PersonNode person={person} x={0} y={0} onPress={onPress} />
    );

    await fireEvent.press(getByTestId('person-node-1'));
    expect(onPress).toHaveBeenCalled();
  });
});
