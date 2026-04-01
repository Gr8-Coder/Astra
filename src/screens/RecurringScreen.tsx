import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RecurringRing } from '../components/charts/RecurringRing';
import { recurringItems, recurringSummary, type RecurringItem } from '../data/recurring';
import { clamp, colors, fonts, formatCurrency, radii, shadows } from '../theme';

function renderCardIcon(item: RecurringItem) {
  if (item.type === 'add') {
    return (
      <Text allowFontScaling={false} style={styles.addCardPlus}>
        +
      </Text>
    );
  }

  if (item.type === 'emoji') {
    return (
      <Text allowFontScaling={false} style={styles.emojiIcon}>
        {item.icon}
      </Text>
    );
  }

  if (item.type === 'brand') {
    if (item.icon === 'spotify') {
      return <FontAwesome5 color="#1ED760" name="spotify" size={24} />;
    }

    if (item.icon === 'google') {
      return <MaterialCommunityIcons color="#4F8FF7" name="google-drive" size={26} />;
    }

    if (item.icon === 'hotstar') {
      return (
        <Text allowFontScaling={false} style={styles.hotstarText}>
          Disney+
        </Text>
      );
    }

    if (item.icon === 'N') {
      return (
        <Text allowFontScaling={false} style={styles.netflixText}>
          N
        </Text>
      );
    }
  }

  return <MaterialCommunityIcons color={colors.textPrimary} name={item.icon as any} size={25} />;
}

export function RecurringScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompact = width < 390;
  const horizontalPadding = clamp(width * 0.052, 16, 24);
  const contentWidth = width - horizontalPadding * 2;
  const gap = 12;
  const cardWidth = (contentWidth - gap * 2) / 3;
  const total = recurringSummary.leftToPay + recurringSummary.paidSoFar;
  const paidRatio = recurringSummary.paidSoFar / total;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: 24 + insets.bottom,
          paddingHorizontal: horizontalPadding
        }
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.summaryShell}>
        <View style={[styles.summaryCard, isCompact ? styles.summaryCardCompact : null]}>
          <View style={styles.summaryBlock}>
            <Text allowFontScaling={false} style={styles.summaryValue}>
              {formatCurrency(recurringSummary.leftToPay)}
            </Text>
            <Text allowFontScaling={false} style={styles.summaryLabel}>
              left to pay
            </Text>
          </View>

          <View style={styles.summaryRingWrap}>
            <RecurringRing paidRatio={paidRatio} size={isCompact ? 76 : 82} strokeWidth={12} />
          </View>

          <View style={[styles.summaryBlock, styles.summaryBlockRight]}>
            <Text allowFontScaling={false} style={styles.summaryValue}>
              {formatCurrency(recurringSummary.paidSoFar)}
            </Text>
            <Text allowFontScaling={false} style={styles.summaryLabel}>
              paid so far
            </Text>
          </View>
        </View>
      </View>

      <Text allowFontScaling={false} style={styles.sectionTitle}>
        This Month
      </Text>

      <View style={styles.grid}>
        {recurringItems.map((item) => (
          <View
            key={`${item.label || 'add'}-${item.dueDay || 'x'}`}
            style={[
              styles.itemCard,
              {
                width: cardWidth
              },
              item.type === 'add' ? styles.addCard : null
            ]}
          >
            {item.paid ? (
              <View style={styles.checkmarkWrap}>
                <Ionicons color={colors.textPrimary} name="checkmark" size={18} />
              </View>
            ) : null}

            <View style={styles.cardContent}>
              {renderCardIcon(item)}

              {item.type !== 'add' ? (
                <>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={2}
                    style={[styles.cardLabel, item.label.length > 9 ? styles.cardLabelCompact : null]}
                  >
                    {item.label}
                  </Text>
                  <Text allowFontScaling={false} style={styles.cardAmount}>
                    {formatCurrency(item.amount)}
                  </Text>
                  <Text allowFontScaling={false} style={styles.cardDue}>
                    {item.dueDay}
                  </Text>
                </>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.futureRow}>
        <Text allowFontScaling={false} style={styles.sectionTitle}>
          In The Future
        </Text>
        <Ionicons color={colors.textPrimary} name="menu" size={26} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 4
  },
  summaryShell: {
    borderRadius: radii.xl,
    marginBottom: 22,
    ...shadows.card
  },
  summaryCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 162,
    paddingHorizontal: 18,
    paddingVertical: 18
  },
  summaryCardCompact: {
    minHeight: 156,
    paddingHorizontal: 14
  },
  summaryBlock: {
    flex: 1
  },
  summaryBlockRight: {
    alignItems: 'flex-end'
  },
  summaryRingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8
  },
  summaryValue: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 15.6
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 8.9,
    lineHeight: 12.5,
    marginTop: 6
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 10.2,
    letterSpacing: 0.8,
    marginBottom: 14,
    textTransform: 'uppercase'
  },
  grid: {
    columnGap: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12
  },
  itemCard: {
    backgroundColor: '#02182D',
    borderRadius: 18,
    minHeight: 126,
    overflow: 'hidden',
    borderColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    ...shadows.card
  },
  addCard: {
    justifyContent: 'center'
  },
  checkmarkWrap: {
    alignItems: 'center',
    position: 'absolute',
    right: 9,
    top: 9,
    zIndex: 1
  },
  cardContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 14
  },
  emojiIcon: {
    fontSize: 27,
    marginBottom: 8
  },
  netflixText: {
    color: '#E50914',
    fontFamily: fonts.bold,
    fontSize: 28,
    marginBottom: 8
  },
  hotstarText: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 9,
    marginBottom: 10
  },
  cardLabel: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 8.6,
    lineHeight: 10.8,
    marginBottom: 7,
    minHeight: 22,
    textAlign: 'center'
  },
  cardLabelCompact: {
    fontSize: 7.8
  },
  cardAmount: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 8.7,
    marginBottom: 4
  },
  cardDue: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 7.2
  },
  addCardPlus: {
    color: colors.textSecondary,
    fontFamily: fonts.light,
    fontSize: 34
  },
  futureRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 22,
    paddingBottom: 6
  }
});
