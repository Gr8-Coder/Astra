import Svg, { Path } from 'react-native-svg';

import { colors } from '../../theme';
import { type TrendPoint } from '../../data/investments';

type SparklineChartProps = {
  color?: string;
  height?: number;
  points: TrendPoint[];
  width?: number;
};

function buildPath(points: TrendPoint[]) {
  if (points.length === 0) {
    return '';
  }

  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
}

export function SparklineChart({
  color = colors.positive,
  height = 70,
  points,
  width = 104
}: SparklineChartProps) {
  return (
    <Svg height={height} preserveAspectRatio="none" viewBox={`0 0 ${width} 80`} width={width}>
      <Path
        d={buildPath(points)}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={4}
      />
    </Svg>
  );
}
