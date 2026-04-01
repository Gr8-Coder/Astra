import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors, fonts } from '../../theme';

type DonutProgressProps = {
  amount: string;
  color: string;
  icon: string;
  progress: number;
  size?: number;
  status: string;
  strokeWidth?: number;
};

export function DonutProgress({
  amount,
  color,
  icon,
  progress,
  size = 74,
  status,
  strokeWidth = 12
}: DonutProgressProps) {
  const boundedProgress = Math.min(Math.max(progress, 0), 1);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - boundedProgress);

  return (
    <View style={styles.wrapper}>
      <View style={[styles.chartShell, { height: size, width: size }]}>
        <Svg height={size} width={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            fill="none"
            r={radius}
            stroke={colors.track}
            strokeWidth={strokeWidth}
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            fill="none"
            r={radius}
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
            stroke={color}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
          />
        </Svg>

        <View
          style={[
            styles.centerBadge,
            {
              height: size * 0.44,
              width: size * 0.44
            }
          ]}
        >
          <Ionicons color={colors.textPrimary} name={icon as any} size={size * 0.22} />
        </View>
      </View>

      <Text allowFontScaling={false} style={styles.amount}>
        {amount}
      </Text>
      <Text allowFontScaling={false} style={styles.status}>
        {status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    width: 88
  },
  chartShell: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    position: 'relative'
  },
  centerBadge: {
    alignItems: 'center',
    backgroundColor: '#0D2339',
    borderRadius: 999,
    justifyContent: 'center',
    position: 'absolute'
  },
  amount: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 15,
    marginBottom: 2
  },
  status: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 14
  }
});
