import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AddPersonScreen from '../add-person';
import { createPersonWithRelationship, createSibling } from '@/lib/tree-data';
import { supabase } from '@/lib/supabase';
import { router, useLocalSearchParams } from 'expo-router';

jest.mock('@/lib/tree-data', () => ({
  createPersonWithRelationship: jest.fn(),
  createSibling: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getUser: jest.fn() } },
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

describe('AddPersonScreen', () => {
  beforeEach(() => {
    (createPersonWithRelationship as jest.Mock).mockReset();
    (createSibling as jest.Mock).mockReset();
    (router.back as jest.Mock).mockReset();
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
  });

  it('creates a parent relationship and navigates back on submit', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      role: 'parent',
      referencePersonId: 'me',
      treeId: 'tree-1',
    });
    (createPersonWithRelationship as jest.Mock).mockResolvedValue({ id: 'new-id' });

    const { getByTestId } = await render(<AddPersonScreen />);
    await fireEvent.changeText(getByTestId('full-name-input'), 'Abuela');
    await fireEvent.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(createPersonWithRelationship).toHaveBeenCalledWith({
        treeId: 'tree-1',
        fullName: 'Abuela',
        isLiving: true,
        birthDate: undefined,
        relationship: { role: 'parent', otherPersonId: 'me', type: 'biological' },
        createdBy: 'user-1',
      });
    });
    expect(router.back).toHaveBeenCalled();
  });

  it('creates a sibling linked to every existing parent on submit', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      role: 'sibling',
      referencePersonId: 'me',
      treeId: 'tree-1',
      parentIds: 'mom,dad',
    });
    (createSibling as jest.Mock).mockResolvedValue({ id: 'new-id' });

    const { getByTestId } = await render(<AddPersonScreen />);
    await fireEvent.changeText(getByTestId('full-name-input'), 'Hermano');
    await fireEvent.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(createSibling).toHaveBeenCalledWith({
        treeId: 'tree-1',
        fullName: 'Hermano',
        isLiving: true,
        birthDate: undefined,
        parentIds: ['mom', 'dad'],
        type: 'biological',
        createdBy: 'user-1',
      });
    });
  });
});
