import Svg, { Circle } from 'react-native-svg';

import { colors } from '../../theme';

export type BudgetMixSegment = {
  color: string;
  ratio: number;
};

type BudgetMixRingProps = {
  segments?: BudgetMixSegment[];
  size?: number;
  strokeWidth?: number;
};

const defaultSegments: BudgetMixSegment[] = [
  { color: '#1CCFC0', ratio: 0.22 },
  { color: '#79E7D1', ratio: 0.15 },
  { color: '#326E62', ratio: 0.43 },
  { color: '#F4CD4F', ratio: 0.2 }
];

export function BudgetMixRing({
  segments = defaultSegments,
  size = 84,
  strokeWidth = 14
}: BudgetMixRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeSegments = segments.filter((segment) => segment.ratio > 0);
  const totalRatio = safeSegments.reduce((sum, segment) => sum + segment.ratio, 0);
  const gap =
    safeSegments.length <= 1
      ? 0
      : Math.min(
          circumference * 0.003,
          (circumference * Math.max(totalRatio, 0.01) * 0.15) / safeSegments.length
        );

  let progressOffset = 0;

  return (
    <Svg height={size} width={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        fill="none"
        r={radius}
        stroke={colors.track}
        strokeWidth={strokeWidth}
      />

      {safeSegments.map((segment, index) => {
        const rawSegmentLength = circumference * segment.ratio;
        const segmentLength = Math.max(rawSegmentLength - gap, 0);
        const dashArray = `${segmentLength} ${circumference}`;
        const dashOffset = -progressOffset;
        progressOffset += rawSegmentLength;

        return (
          <Circle
            key={`${segment.color}-${index}`}
            cx={size / 2}
            cy={size / 2}
            fill="none"
            origin={`${size / 2}, ${size / 2}`}
            r={radius}
            rotation={-90}
            stroke={segment.color}
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            strokeLinecap="butt"
            strokeWidth={strokeWidth}
          />
        );
      })}
    </Svg>
  );
}
