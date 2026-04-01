import Svg, { Circle, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';

import { colors } from '../../theme';

type Point = {
  x: number;
  y: number;
};

type BudgetTrendChartProps = {
  height: number;
};

const guidePoints: Point[] = [
  { x: 18, y: 112 },
  { x: 80, y: 96 },
  { x: 150, y: 80 },
  { x: 224, y: 62 },
  { x: 302, y: 44 }
];

const trendStart: Point[] = [
  { x: 18, y: 118 },
  { x: 68, y: 98 },
  { x: 122, y: 72 },
  { x: 160, y: 84 },
  { x: 190, y: 72 }
];

const trendYellow: Point[] = [
  { x: 190, y: 72 },
  { x: 204, y: 52 }
];

const trendOrange: Point[] = [
  { x: 204, y: 52 },
  { x: 220, y: 52 }
];

const trendEnd: Point[] = [
  { x: 220, y: 52 },
  { x: 236, y: 52 }
];

const projectionPoints: Point[] = [
  { x: 236, y: 52 },
  { x: 302, y: 42 }
];

function buildPath(points: Point[]) {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
}

export function BudgetTrendChart({ height }: BudgetTrendChartProps) {
  return (
    <Svg
      height={height}
      preserveAspectRatio="xMidYMid meet"
      viewBox="0 0 320 148"
      width="100%"
    >
      <Path
        d={buildPath(guidePoints)}
        fill="none"
        opacity={0.8}
        stroke={colors.accentDeep}
        strokeDasharray="2 5"
        strokeLinecap="round"
        strokeWidth={4}
      />

      <Path
        d={buildPath(trendStart)}
        fill="none"
        stroke={colors.positive}
        strokeLinecap="round"
        strokeWidth={6}
      />
      <Path
        d={buildPath(trendYellow)}
        fill="none"
        stroke={colors.warning}
        strokeLinecap="round"
        strokeWidth={6}
      />
      <Path
        d={buildPath(trendOrange)}
        fill="none"
        stroke={colors.orange}
        strokeLinecap="round"
        strokeWidth={6}
      />
      <Path
        d={buildPath(trendEnd)}
        fill="none"
        stroke={colors.positiveSoft}
        strokeLinecap="round"
        strokeWidth={6}
      />
      <Path
        d={buildPath(projectionPoints)}
        fill="none"
        stroke={colors.accentDeep}
        strokeDasharray="2 5"
        strokeLinecap="round"
        strokeWidth={4}
      />

      <Circle cx={236} cy={52} fill={colors.positive} r={12} />
      <Polygon fill={colors.positive} points="236,64 248,78 236,82" />
      <Rect fill={colors.positive} height={42} rx={12} width={94} x={214} y={80} />
      <SvgText
        fill={colors.background}
        fontSize={15}
        fontWeight="700"
        textAnchor="middle"
        x={261}
        y={106}
      >
        ₹ 180 under
      </SvgText>
    </Svg>
  );
}
