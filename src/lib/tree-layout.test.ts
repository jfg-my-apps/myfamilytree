import { computeTreeLayout } from './tree-layout';
import { RelationshipEdge } from './family-graph';

describe('computeTreeLayout', () => {
  it('places a lone focus person at the origin', () => {
    const positions = computeTreeLayout(['me'], [], 'me');
    expect(positions).toEqual([{ personId: 'me', x: 0, y: 0, generation: 0 }]);
  });

  it('places a parent above and a child below the focus person', () => {
    const edges: RelationshipEdge[] = [
      { parentId: 'mom', childId: 'me' },
      { parentId: 'me', childId: 'kid' },
    ];
    const positions = computeTreeLayout(['me', 'mom', 'kid'], edges, 'me');

    const byId = Object.fromEntries(positions.map((p) => [p.personId, p]));
    expect(byId.me).toEqual({ personId: 'me', x: 0, y: 0, generation: 0 });
    expect(byId.mom.generation).toBe(-1);
    expect(byId.mom.y).toBeLessThan(0);
    expect(byId.kid.generation).toBe(1);
    expect(byId.kid.y).toBeGreaterThan(0);
  });

  it('places siblings (shared parent) in the same row as the focus person, sorted and spaced', () => {
    const edges: RelationshipEdge[] = [
      { parentId: 'mom', childId: 'A' },
      { parentId: 'mom', childId: 'B' },
      { parentId: 'mom', childId: 'C' },
    ];
    const positions = computeTreeLayout(['A', 'B', 'C', 'mom'], edges, 'B');

    const byId = Object.fromEntries(positions.map((p) => [p.personId, p]));
    expect(byId.A.generation).toBe(0);
    expect(byId.B.generation).toBe(0);
    expect(byId.C.generation).toBe(0);
    // sorted alphabetically and centered: A, B, C -> -220, 0, 220
    expect(byId.A.x).toBeLessThan(byId.B.x);
    expect(byId.B.x).toBeLessThan(byId.C.x);
    expect(byId.B.x).toBe(0);
  });

  it('clusters a child near their own parent instead of pure alphabetical order', () => {
    // "me" and "aunt" are siblings (share "grandma"); "me" has child "Zack",
    // "aunt" has child "Ana". Whichever side "me" vs "aunt" land on, their
    // own children must land on the same side as them, not be scattered by
    // plain alphabetical order across the row below.
    const edges: RelationshipEdge[] = [
      { parentId: 'grandma', childId: 'me' },
      { parentId: 'grandma', childId: 'aunt' },
      { parentId: 'me', childId: 'Zack' },
      { parentId: 'aunt', childId: 'Ana' },
    ];
    const positions = computeTreeLayout(
      ['me', 'aunt', 'grandma', 'Zack', 'Ana'],
      edges,
      'me'
    );
    const byId = Object.fromEntries(positions.map((p) => [p.personId, p]));

    expect(Math.sign(byId.Zack.x - byId.Ana.x)).toBe(Math.sign(byId.me.x - byId.aunt.x));
  });
});
