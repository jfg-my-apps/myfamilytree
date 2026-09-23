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
  const countPerGenerationRow = new Map<number, number>();
  for (const position of personPositions) {
    countPerGenerationRow.set(
      position.generation,
      (countPerGenerationRow.get(position.generation) ?? 0) + 1
    );
  }

  return slots.map((slot) => {
    const anchor = positionByPersonId.get(slot.personId);
    const anchorGeneration = anchor?.generation ?? 0;
    const generation =
      slot.role === 'parent'
        ? anchorGeneration - 1
        : slot.role === 'child'
          ? anchorGeneration + 1
          : anchorGeneration;

    const indexInRow = countPerGenerationRow.get(generation) ?? 0;
    countPerGenerationRow.set(generation, indexInRow + 1);

    return {
      ...slot,
      x: indexInRow * NODE_SPACING_X,
      y: generation * GENERATION_SPACING_Y,
    };
  });
}
