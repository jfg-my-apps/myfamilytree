import {
  createPersonWithRelationship,
  createSibling,
  mergeNeighborhoods,
  Neighborhood,
} from './tree-data';
import { supabase } from './supabase';

jest.mock('./supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getUser: jest.fn() },
  },
}));

describe('mergeNeighborhoods', () => {
  it('unions people by id without duplicates', () => {
    const a: Neighborhood = {
      people: [{ id: '1', fullName: 'A', isLiving: true, birthDate: null, deathDate: null }],
      edges: [],
    };
    const b: Neighborhood = {
      people: [
        { id: '1', fullName: 'A', isLiving: true, birthDate: null, deathDate: null },
        { id: '2', fullName: 'B', isLiving: true, birthDate: null, deathDate: null },
      ],
      edges: [],
    };
    const merged = mergeNeighborhoods(a, b);
    expect(merged.people.map((p) => p.id).sort()).toEqual(['1', '2']);
  });

  it('unions edges without duplicating the same parent-child pair', () => {
    const a: Neighborhood = { people: [], edges: [{ parentId: 'p', childId: 'c' }] };
    const b: Neighborhood = {
      people: [],
      edges: [
        { parentId: 'p', childId: 'c' },
        { parentId: 'p', childId: 'c2' },
      ],
    };
    const merged = mergeNeighborhoods(a, b);
    expect(merged.edges).toHaveLength(2);
  });
});

describe('createPersonWithRelationship', () => {
  it('inserts the person then the parent-child relationship in the right direction', async () => {
    const insertedPerson = {
      id: 'new-id',
      full_name: 'Abuela',
      is_living: false,
      birth_date: null,
      death_date: null,
    };
    const single = jest.fn().mockResolvedValue({ data: insertedPerson, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const personInsert = jest.fn().mockReturnValue({ select });
    const relInsert = jest.fn().mockResolvedValue({ error: null });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'people') return { insert: personInsert };
      if (table === 'relationships') return { insert: relInsert };
      throw new Error(`unexpected table ${table}`);
    });

    const result = await createPersonWithRelationship({
      treeId: 'tree-1',
      fullName: 'Abuela',
      isLiving: false,
      relationship: { role: 'parent', otherPersonId: 'me', type: 'biological' },
      createdBy: 'user-1',
    });

    expect(result.id).toBe('new-id');
    expect(relInsert).toHaveBeenCalledWith({
      tree_id: 'tree-1',
      parent_id: 'new-id',
      child_id: 'me',
      type: 'biological',
    });
  });
});

describe('createSibling', () => {
  it('links the new person as a child of every existing parent', async () => {
    const insertedPerson = {
      id: 'new-id',
      full_name: 'Hermano',
      is_living: true,
      birth_date: null,
      death_date: null,
    };
    const single = jest.fn().mockResolvedValue({ data: insertedPerson, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const personInsert = jest.fn().mockReturnValue({ select });
    const relInsert = jest.fn().mockResolvedValue({ error: null });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'people') return { insert: personInsert };
      if (table === 'relationships') return { insert: relInsert };
      throw new Error(`unexpected table ${table}`);
    });

    await createSibling({
      treeId: 'tree-1',
      fullName: 'Hermano',
      isLiving: true,
      parentIds: ['mom', 'dad'],
      type: 'biological',
      createdBy: 'user-1',
    });

    expect(relInsert).toHaveBeenCalledWith([
      { tree_id: 'tree-1', parent_id: 'mom', child_id: 'new-id', type: 'biological' },
      { tree_id: 'tree-1', parent_id: 'dad', child_id: 'new-id', type: 'biological' },
    ]);
  });
});
