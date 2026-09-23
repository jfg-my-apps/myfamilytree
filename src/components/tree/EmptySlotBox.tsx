import { G, Rect, Text as SvgText } from 'react-native-svg';
import type { PositionedSlot } from '@/lib/tree-slots';

const WIDTH = 180;
const HEIGHT = 70;

export function EmptySlotBox({
  slot,
  label,
  onPress,
}: {
  slot: PositionedSlot;
  label: string;
  onPress: () => void;
}) {
  return (
    <G testID={`empty-slot-${slot.personId}-${slot.role}`} onPress={onPress}>
      <Rect
        x={slot.x - WIDTH / 2}
        y={slot.y - HEIGHT / 2}
        width={WIDTH}
        height={HEIGHT}
        rx={10}
        fill="none"
        stroke="#9aa0a6"
        strokeDasharray="6,4"
        strokeWidth={1.5}
      />
      <SvgText x={slot.x} y={slot.y} textAnchor="middle" fontSize={13} fill="#5b5f66">
        {label}
      </SvgText>
    </G>
  );
}
