import { fireEvent, render } from '@testing-library/react-native';
import { TreeCanvas } from '../TreeCanvas';

describe('TreeCanvas', () => {
  it('renders a node per person and calls onPersonPress when one is tapped', async () => {
    const onPersonPress = jest.fn();
    const neighborhood = {
      people: [
        { id: 'me', fullName: 'Yo', isLiving: true, birthDate: null, deathDate: null },
        { id: 'mom', fullName: 'Mamá', isLiving: true, birthDate: null, deathDate: null },
      ],
      edges: [{ parentId: 'mom', childId: 'me' }],
    };

    const { getByTestId } = await render(
      <TreeCanvas
        neighborhood={neighborhood}
        focusPersonId="me"
        onPersonPress={onPersonPress}
        onSlotPress={jest.fn()}
      />
    );

    await fireEvent.press(getByTestId('person-node-mom'));
    expect(onPersonPress).toHaveBeenCalledWith('mom');
  });

  it('renders an empty slot and calls onSlotPress when tapped', async () => {
    const onSlotPress = jest.fn();
    const neighborhood = {
      people: [{ id: 'me', fullName: 'Yo', isLiving: true, birthDate: null, deathDate: null }],
      edges: [],
    };

    const { getByTestId } = await render(
      <TreeCanvas
        neighborhood={neighborhood}
        focusPersonId="me"
        onPersonPress={jest.fn()}
        onSlotPress={onSlotPress}
      />
    );

    await fireEvent.press(getByTestId('empty-slot-me-child'));
    expect(onSlotPress).toHaveBeenCalledWith({ personId: 'me', role: 'child' });
  });

  it('labels each slot with the first name of the person it belongs to', async () => {
    const neighborhood = {
      people: [
        { id: 'me', fullName: 'Juan Fernando', isLiving: true, birthDate: null, deathDate: null },
        {
          id: 'sister',
          fullName: 'Lina Maria Gutierrez',
          isLiving: true,
          birthDate: null,
          deathDate: null,
        },
      ],
      edges: [{ parentId: 'mom', childId: 'me' }, { parentId: 'mom', childId: 'sister' }],
    };

    const { getByTestId } = await render(
      <TreeCanvas
        neighborhood={neighborhood}
        focusPersonId="me"
        onPersonPress={jest.fn()}
        onSlotPress={jest.fn()}
      />
    );

    expect(getByTestId('empty-slot-me-child-label').props.children.props.children).toBe(
      '+ Agregar hijo/a de Juan'
    );
    expect(getByTestId('empty-slot-sister-child-label').props.children.props.children).toBe(
      '+ Agregar hijo/a de Lina'
    );
  });
});
