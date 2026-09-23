import { mergeNeighborhoods, Neighborhood } from './tree-data';

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
