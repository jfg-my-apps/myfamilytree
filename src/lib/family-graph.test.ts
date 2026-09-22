import { wouldCreateCycle, RelationshipEdge } from './family-graph';

describe('wouldCreateCycle', () => {
  it('detects a direct cycle (person cannot be their own parent)', () => {
    const edges: RelationshipEdge[] = [];
    expect(wouldCreateCycle(edges, 'A', 'A')).toBe(true);
  });

  it('detects an indirect cycle through existing ancestors', () => {
    const edges: RelationshipEdge[] = [
      { parentId: 'A', childId: 'B' },
      { parentId: 'B', childId: 'C' },
    ];
    // C -> A cerraría el loop A -> B -> C -> A
    expect(wouldCreateCycle(edges, 'C', 'A')).toBe(true);
  });

  it('allows adding a second parent to the same child', () => {
    const edges: RelationshipEdge[] = [{ parentId: 'A', childId: 'B' }];
    expect(wouldCreateCycle(edges, 'C', 'B')).toBe(false);
  });

  it('allows unrelated new relationships', () => {
    const edges: RelationshipEdge[] = [{ parentId: 'A', childId: 'B' }];
    expect(wouldCreateCycle(edges, 'X', 'Y')).toBe(false);
  });
});
