import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '../../theme';
import { type TrendPoint } from '../../data/investments';

type InvestmentTrendChartProps = {
  color?: string;
  height?: number;
  points: TrendPoint[];
  strokeWidth?: number;
};

function buildSmoothPath(points: TrendPoint[]) {
  if (points.length === 0) {
    return '';
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const controlX = (previous.x + current.x) / 2;

    path += ` C ${controlX} ${previous.y}, ${controlX} ${current.y}, ${current.x} ${current.y}`;
  }

  return path;
}

export function InvestmentTrendChart({
  color = colors.positive,
  height = 126,
  points,
  strokeWidth = 5
}: InvestmentTrendChartProps) {
  const path = buildSmoothPath(points);
  const lastPoint = points[points.length - 1];
  const width = points.length > 0 ? points[points.length - 1].x + 18 : 180;
  const dotRadius = strokeWidth > 4 ? 9 : 5;

  return (
    <Svg height={height} preserveAspectRatio="xMinYMid meet" viewBox={`0 0 ${width} 110`} width="100%">
      <Path
        d={path}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      {lastPoint ? <Circle cx={lastPoint.x} cy={lastPoint.y} fill={color} r={dotRadius} /> : null}
    </Svg>
  );
}
