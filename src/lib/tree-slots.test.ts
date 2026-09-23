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
});
