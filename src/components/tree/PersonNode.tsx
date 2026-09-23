import { G, Rect, Text as SvgText } from 'react-native-svg';
import type { Person } from '@/lib/tree-data';

const WIDTH = 180;
const HEIGHT = 70;

export function PersonNode({
  person,
  x,
  y,
  onPress,
}: {
  person: Person;
  x: number;
  y: number;
  onPress: () => void;
}) {
  return (
    <G testID={`person-node-${person.id}`} onPress={onPress}>
      <Rect
        x={x - WIDTH / 2}
        y={y - HEIGHT / 2}
        width={WIDTH}
        height={HEIGHT}
        rx={10}
        fill={person.isLiving ? '#e8f0fe' : '#f1f1ee'}
        stroke="#3c87f7"
        strokeWidth={1.5}
      />
      <SvgText x={x} y={y} textAnchor="middle" fontSize={14} fill="#16181c">
        {person.fullName}
      </SvgText>
    </G>
  );
}
