import Svg, { Circle } from 'react-native-svg';

type RecurringRingProps = {
  paidRatio: number;
  size?: number;
  strokeWidth?: number;
};

export function RecurringRing({ paidRatio, size = 84, strokeWidth = 14 }: RecurringRingProps) {
  const bounded = Math.min(Math.max(paidRatio, 0), 1);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - bounded);

  return (
    <Svg height={size} width={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        fill="none"
        r={radius}
        stroke="#27385A"
        strokeWidth={strokeWidth}
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        fill="none"
        origin={`${size / 2}, ${size / 2}`}
        r={radius}
        rotation={-90}
        stroke="#4C43C8"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="butt"
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}
