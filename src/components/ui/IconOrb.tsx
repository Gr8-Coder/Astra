import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { colors } from '../../theme';

type IconOrbProps = {
  backgroundColor?: string;
  color?: string;
  name: string;
  orbSize?: number;
  size?: number;
};

export function IconOrb({
  backgroundColor = 'rgba(255, 255, 255, 0.12)',
  color = colors.textPrimary,
  name,
  orbSize = 26,
  size = 14
}: IconOrbProps) {
  return (
    <View
      style={[
        styles.orb,
        {
          backgroundColor,
          borderRadius: orbSize / 2,
          height: orbSize,
          width: orbSize
        }
      ]}
    >
      <Ionicons color={color} name={name as any} size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    alignItems: 'center',
    justifyContent: 'center'
  }
});
