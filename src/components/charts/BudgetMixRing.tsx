import Svg, { Circle } from 'react-native-svg';

import { colors } from '../../theme';

type BudgetMixRingProps = {
  size?: number;
  strokeWidth?: number;
};

const segments = [
  { color: '#1CCFC0', ratio: 0.22 },
  { color: '#79E7D1', ratio: 0.15 },
  { color: '#326E62', ratio: 0.43 },
  { color: '#F4CD4F', ratio: 0.2 }
];

export function BudgetMixRing({ size = 84, strokeWidth = 14 }: BudgetMixRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = circumference * 0.035;

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

      {segments.map((segment) => {
        const segmentLength = circumference * segment.ratio - gap;
        const dashArray = `${segmentLength} ${circumference}`;
        const dashOffset = -progressOffset;
        progressOffset += circumference * segment.ratio;

        return (
          <Circle
            key={segment.color}
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
