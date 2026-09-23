import { ScrollView, StyleSheet } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { computeTreeLayout, resolveRowCollisions, GENERATION_SPACING_Y } from '@/lib/tree-layout';
import { computeEmptySlots, computeSlotPositions } from '@/lib/tree-slots';
import type { Neighborhood } from '@/lib/tree-data';
import type { EmptySlot, PositionedSlot } from '@/lib/tree-slots';
import { PersonNode } from './PersonNode';
import { EmptySlotBox } from './EmptySlotBox';

const CANVAS_PADDING = 400;

const SLOT_ROLE_LABEL: Record<EmptySlot['role'], string> = {
  parent: '+ Agregar padre/madre de',
  child: '+ Agregar hijo/a de',
  sibling: '+ Agregar hermano/a de',
};

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

type RowItem =
  | { kind: 'person'; key: string; personId: string; x: number; y: number; generation: number }
  | { kind: 'slot'; key: string; slot: PositionedSlot; x: number; y: number; generation: number };

export function TreeCanvas({
  neighborhood,
  focusPersonId,
  onPersonPress,
  onSlotPress,
}: {
  neighborhood: Neighborhood;
  focusPersonId: string;
  onPersonPress: (personId: string) => void;
  onSlotPress: (slot: EmptySlot) => void;
}) {
  const personIds = neighborhood.people.map((p) => p.id);
  const personById = new Map(neighborhood.people.map((p) => [p.id, p]));
  const rawPositions = computeTreeLayout(personIds, neighborhood.edges, focusPersonId);
  const rawSlots = computeSlotPositions(
    computeEmptySlots(personIds, neighborhood.edges),
    rawPositions
  );

  // Slots are placed relative to their own anchor independently of anything
  // else already at that spot, so a final pass spreads apart anything (a
  // person, a slot, or both) that landed on the exact same (generation, x).
  const combined: RowItem[] = [
    ...rawPositions.map((p) => ({
      kind: 'person' as const,
      key: `person:${p.personId}`,
      personId: p.personId,
      x: p.x,
      y: p.y,
      generation: p.generation,
    })),
    ...rawSlots.map((s) => ({
      kind: 'slot' as const,
      key: `slot:${s.personId}:${s.role}`,
      slot: s,
      x: s.x,
      y: s.y,
      generation: Math.round(s.y / GENERATION_SPACING_Y),
    })),
  ];
  const resolved = resolveRowCollisions(combined, (item) => item.key);

  const positionByPersonId = new Map<string, { x: number; y: number }>();
  const positionedSlots: PositionedSlot[] = [];
  for (const item of resolved) {
    if (item.kind === 'person') {
      positionByPersonId.set(item.personId, { x: item.x, y: item.y });
    } else {
      positionedSlots.push({ ...item.slot, x: item.x, y: item.y });
    }
  }

  const xs = resolved.map((item) => item.x);
  const ys = resolved.map((item) => item.y);
  const minX = Math.min(0, ...xs) - CANVAS_PADDING;
  const maxX = Math.max(0, ...xs) + CANVAS_PADDING;
  const minY = Math.min(0, ...ys) - CANVAS_PADDING;
  const maxY = Math.max(0, ...ys) + CANVAS_PADDING;
  const width = maxX - minX;
  const height = maxY - minY;

  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      style={styles.outer}
      contentContainerStyle={{ width }}
      testID="tree-canvas-scroll-x"
    >
      <ScrollView
        nestedScrollEnabled
        style={{ width }}
        contentContainerStyle={{ height }}
        testID="tree-canvas-scroll-y"
      >
        <Svg width={width} height={height} viewBox={`${minX} ${minY} ${width} ${height}`}>
          {neighborhood.edges.map((edge) => {
            const parent = positionByPersonId.get(edge.parentId);
            const child = positionByPersonId.get(edge.childId);
            if (!parent || !child) return null;
            return (
              <Line
                key={`${edge.parentId}:${edge.childId}`}
                x1={parent.x}
                y1={parent.y}
                x2={child.x}
                y2={child.y}
                stroke="#9aa0a6"
                strokeWidth={1.5}
              />
            );
          })}
          {positionedSlots.map((slot) => {
            const anchor = positionByPersonId.get(slot.personId);
            return (
              <Line
                key={`slot-line-${slot.personId}-${slot.role}`}
                testID={`slot-line-${slot.personId}-${slot.role}`}
                x1={anchor?.x ?? slot.x}
                y1={anchor?.y ?? slot.y}
                x2={slot.x}
                y2={slot.y}
                stroke="#c2c6cc"
                strokeWidth={1}
                strokeDasharray="4,4"
              />
            );
          })}
          {positionedSlots.map((slot) => {
            const owner = personById.get(slot.personId);
            const label = owner
              ? `${SLOT_ROLE_LABEL[slot.role]} ${firstName(owner.fullName)}`
              : SLOT_ROLE_LABEL[slot.role];
            return (
              <EmptySlotBox
                key={`${slot.personId}-${slot.role}`}
                slot={slot}
                label={label}
                onPress={() => onSlotPress({ personId: slot.personId, role: slot.role })}
              />
            );
          })}
          {neighborhood.people.map((person) => {
            const position = positionByPersonId.get(person.id);
            if (!position) return null;
            return (
              <PersonNode
                key={person.id}
                person={person}
                x={position.x}
                y={position.y}
                onPress={() => onPersonPress(person.id)}
              />
            );
          })}
        </Svg>
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1 },
});
