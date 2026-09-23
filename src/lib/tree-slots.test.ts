import { computeEmptySlots, computeSlotPositions } from './tree-slots';
import { RelationshipEdge } from './family-graph';
import { computeTreeLayout } from './tree-layout';

describe('computeEmptySlots', () => {
  it('offers a parent slot and a child slot for a person with no relationships', () => {
    const slots = computeEmptySlots(['me'], []);
    expect(slots).toContainEqual({ personId: 'me', role: 'parent' });
    expect(slots).toContainEqual({ personId: 'me', role: 'child' });
    expect(slots).not.toContainEqual({ personId: 'me', role: 'sibling' });
  });

  it('stops offering a parent slot once 2 parents are recorded', () => {
    const edges: RelationshipEdge[] = [
      { parentId: 'mom', childId: 'me' },
      { parentId: 'dad', childId: 'me' },
    ];
    const slots = computeEmptySlots(['me'], edges);
    expect(slots.filter((s) => s.personId === 'me' && s.role === 'parent')).toHaveLength(0);
  });

  it('offers a sibling slot once at least 1 parent is recorded', () => {
    const edges: RelationshipEdge[] = [{ parentId: 'mom', childId: 'me' }];
    const slots = computeEmptySlots(['me'], edges);
    expect(slots).toContainEqual({ personId: 'me', role: 'sibling' });
  });
});

describe('computeSlotPositions', () => {
  it('places a parent slot one generation above its reference person', () => {
    const positions = computeTreeLayout(['me'], [], 'me');
    const slots = computeSlotPositions([{ personId: 'me', role: 'parent' }], positions);
    expect(slots[0].y).toBeLessThan(positions[0].y);
  });

  it('places a child slot one generation below its reference person', () => {
    const positions = computeTreeLayout(['me'], [], 'me');
    const slots = computeSlotPositions([{ personId: 'me', role: 'child' }], positions);
    expect(slots[0].y).toBeGreaterThan(positions[0].y);
  });

  it('aligns a parent slot with its own reference person, not with unrelated people in the same row', () => {
    // Two people in the same generation (e.g. both parents of "me") each get
    // their own parent slot — those must land above their own x, not be
    // indistinguishable from each other.
    const edges: RelationshipEdge[] = [
      { parentId: 'dad', childId: 'me' },
      { parentId: 'mom', childId: 'me' },
    ];
    const positions = computeTreeLayout(['me', 'dad', 'mom'], edges, 'me');
    const byId = Object.fromEntries(positions.map((p) => [p.personId, p]));

    const slots = computeSlotPositions(
      [
        { personId: 'dad', role: 'parent' },
        { personId: 'mom', role: 'parent' },
      ],
      positions
    );
    const slotByPersonId = Object.fromEntries(slots.map((s) => [s.personId, s]));

    expect(slotByPersonId.dad.x).toBe(byId.dad.x);
    expect(slotByPersonId.mom.x).toBe(byId.mom.x);
  });

  it('offsets a sibling slot beside its reference person instead of on top of it', () => {
    const positions = computeTreeLayout(['me'], [], 'me');
    const slots = computeSlotPositions([{ personId: 'me', role: 'sibling' }], positions);
    expect(slots[0].y).toBe(positions[0].y);
    expect(slots[0].x).not.toBe(positions[0].x);
  });
});
