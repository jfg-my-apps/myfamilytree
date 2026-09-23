import { computeTreeLayout, resolveRowCollisions, NODE_SPACING_X } from './tree-layout';
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

  it('spreads two co-parents apart instead of stacking them at the same x', () => {
    // "dad" and "mom" are both parents of "me" and "sister" — every child
    // they have in common is identical, so a naive "average of my
    // children's x" computation gives both parents the exact same column.
    const edges: RelationshipEdge[] = [
      { parentId: 'dad', childId: 'me' },
      { parentId: 'mom', childId: 'me' },
      { parentId: 'dad', childId: 'sister' },
      { parentId: 'mom', childId: 'sister' },
    ];
    const positions = computeTreeLayout(['me', 'sister', 'dad', 'mom'], edges, 'me');
    const byId = Object.fromEntries(positions.map((p) => [p.personId, p]));

    // Not just "different" — far enough apart that 180px-wide boxes can't
    // visually overlap (this exact case regressed once already: a 110px
    // gap counted as "resolved" but the boxes still touched on screen).
    expect(Math.abs(byId.dad.x - byId.mom.x)).toBeGreaterThanOrEqual(NODE_SPACING_X);
  });

  it('never places two different people at the same (x, y) at any scale', () => {
    // A denser regression guard: three generations, a couple with two
    // children each of whom also has a child of their own. Nothing here
    // should ever coincide on screen.
    const edges: RelationshipEdge[] = [
      { parentId: 'dad', childId: 'me' },
      { parentId: 'mom', childId: 'me' },
      { parentId: 'dad', childId: 'sister' },
      { parentId: 'mom', childId: 'sister' },
      { parentId: 'me', childId: 'kid1' },
      { parentId: 'sister', childId: 'kid2' },
    ];
    const personIds = ['me', 'sister', 'dad', 'mom', 'kid1', 'kid2'];
    const positions = computeTreeLayout(personIds, edges, 'me');

    const byGeneration = new Map<number, number[]>();
    for (const p of positions) {
      const xs = byGeneration.get(p.generation) ?? [];
      xs.push(p.x);
      byGeneration.set(p.generation, xs);
    }
    for (const xs of byGeneration.values()) {
      const sorted = [...xs].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(NODE_SPACING_X);
      }
    }
  });
});

describe('resolveRowCollisions', () => {
  it('leaves items alone when nothing collides', () => {
    const items = [
      { id: 'a', generation: 0, x: -220 },
      { id: 'b', generation: 0, x: 220 },
    ];
    const resolved = resolveRowCollisions(items, (item) => item.id);
    expect(resolved.map((i) => i.x).sort()).toEqual([-220, 220]);
  });

  it('spreads items that landed on the exact same x within a generation', () => {
    const items = [
      { id: 'a', generation: 0, x: 0 },
      { id: 'b', generation: 0, x: 0 },
    ];
    const resolved = resolveRowCollisions(items, (item) => item.id);
    const xById = Object.fromEntries(resolved.map((i) => [i.id, i.x]));
    expect(Math.abs(xById.a - xById.b)).toBeGreaterThanOrEqual(NODE_SPACING_X);
  });

  it('spreads items that are merely close, not just exactly tied', () => {
    // The bug that actually shipped: two items 110px apart (half the min
    // gap) counted as "not colliding" under exact-equality checks, but
    // still visually overlapped since nodes are ~180px wide.
    const items = [
      { id: 'a', generation: 0, x: 0 },
      { id: 'b', generation: 0, x: NODE_SPACING_X / 2 },
    ];
    const resolved = resolveRowCollisions(items, (item) => item.id);
    const xById = Object.fromEntries(resolved.map((i) => [i.id, i.x]));
    expect(Math.abs(xById.a - xById.b)).toBeGreaterThanOrEqual(NODE_SPACING_X);
  });

  it('does not move items from different generations even if their x matches', () => {
    const items = [
      { id: 'a', generation: 0, x: 0 },
      { id: 'b', generation: 1, x: 0 },
    ];
    const resolved = resolveRowCollisions(items, (item) => item.id);
    const xById = Object.fromEntries(resolved.map((i) => [i.id, i.x]));
    expect(xById.a).toBe(0);
    expect(xById.b).toBe(0);
  });
});
