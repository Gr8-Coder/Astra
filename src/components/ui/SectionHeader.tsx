import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../../theme';

type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
};

export function SectionHeader({ title, actionLabel = 'view all >' }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text allowFontScaling={false} style={styles.title}>
        {title}
      </Text>
      <Text allowFontScaling={false} style={styles.action}>
        {actionLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14
  },
  title: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 11.2,
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  action: {
    color: colors.accentSoft,
    fontFamily: fonts.medium,
    fontSize: 11.6
  }
});
