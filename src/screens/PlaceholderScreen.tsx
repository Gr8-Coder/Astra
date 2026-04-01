import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { clamp, colors, fonts, radii, shadows } from '../theme';

type PlaceholderScreenProps = {
  body: string;
  title: string;
};

export function PlaceholderScreen({ body, title }: PlaceholderScreenProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const horizontalPadding = clamp(width * 0.06, 18, 28);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: 32 + insets.bottom,
          paddingHorizontal: horizontalPadding
        }
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 12
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.surfaceOutline,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: 28,
    ...shadows.card
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 26,
    marginBottom: 10,
    textAlign: 'center'
  },
  body: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center'
  }
});
