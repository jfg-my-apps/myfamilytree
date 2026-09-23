import { ScrollView, StyleSheet } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { computeTreeLayout } from '@/lib/tree-layout';
import { computeEmptySlots, computeSlotPositions } from '@/lib/tree-slots';
import type { Neighborhood } from '@/lib/tree-data';
import type { EmptySlot } from '@/lib/tree-slots';
import { PersonNode } from './PersonNode';
import { EmptySlotBox } from './EmptySlotBox';

const CANVAS_PADDING = 400;

const SLOT_LABELS: Record<EmptySlot['role'], string> = {
  parent: '+ Agregar padre/madre',
  child: '+ Agregar hijo/a',
  sibling: '+ Agregar hermano/a',
};

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
  const positions = computeTreeLayout(personIds, neighborhood.edges, focusPersonId);
  const positionByPersonId = new Map(positions.map((p) => [p.personId, p]));
  const slots = computeEmptySlots(personIds, neighborhood.edges);
  const positionedSlots = computeSlotPositions(slots, positions);

  const xs = [...positions.map((p) => p.x), ...positionedSlots.map((s) => s.x)];
  const ys = [...positions.map((p) => p.y), ...positionedSlots.map((s) => s.y)];
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
          {positionedSlots.map((slot) => (
            <EmptySlotBox
              key={`${slot.personId}-${slot.role}`}
              slot={slot}
              label={SLOT_LABELS[slot.role]}
              onPress={() => onSlotPress({ personId: slot.personId, role: slot.role })}
            />
          ))}
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
