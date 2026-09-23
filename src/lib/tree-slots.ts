import { RelationshipEdge } from './family-graph';
import { GENERATION_SPACING_Y, NODE_SPACING_X, PersonPosition } from './tree-layout';

export type SlotRole = 'parent' | 'child' | 'sibling';

export type EmptySlot = {
  personId: string;
  role: SlotRole;
};

export type PositionedSlot = EmptySlot & { x: number; y: number };

const MAX_PARENTS = 2;

export function computeEmptySlots(personIds: string[], edges: RelationshipEdge[]): EmptySlot[] {
  const slots: EmptySlot[] = [];
  for (const personId of personIds) {
    const parentCount = edges.filter((e) => e.childId === personId).length;
    if (parentCount < MAX_PARENTS) {
      slots.push({ personId, role: 'parent' });
    }
    slots.push({ personId, role: 'child' });
    if (parentCount > 0) {
      slots.push({ personId, role: 'sibling' });
    }
  }
  return slots;
}

export function computeSlotPositions(
  slots: EmptySlot[],
  personPositions: PersonPosition[]
): PositionedSlot[] {
  const positionByPersonId = new Map(personPositions.map((p) => [p.personId, p]));

  return slots.map((slot) => {
    const anchor = positionByPersonId.get(slot.personId);
    const anchorX = anchor?.x ?? 0;
    const anchorGeneration = anchor?.generation ?? 0;

    // A sibling slot shares its anchor's generation, so it must sit beside
    // the anchor rather than on top of it. Parent/child slots move to a
    // different generation row, so lining up under the anchor's own x
    // can't collide with the anchor itself.
    if (slot.role === 'sibling') {
      return {
        ...slot,
        x: anchorX + NODE_SPACING_X,
        y: anchorGeneration * GENERATION_SPACING_Y,
      };
    }

    const generation = slot.role === 'parent' ? anchorGeneration - 1 : anchorGeneration + 1;
    return {
      ...slot,
      x: anchorX,
      y: generation * GENERATION_SPACING_Y,
    };
  });
}
