import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { transactionGroups, type TransactionItem } from '../data/transactions';
import { clamp, colors, fonts, formatCurrency, radii } from '../theme';

function amountText(item: TransactionItem) {
  return item.amountLabel ?? formatCurrency(item.amount);
}

function CategoryPill({
  category,
  icon,
  pillColor
}: {
  category: string;
  icon: string;
  pillColor: string;
}) {
  const isLong = category.length > 12;

  return (
    <View style={[styles.categoryPill, { backgroundColor: pillColor }, isLong ? styles.categoryPillLong : null]}>
      <Text allowFontScaling={false} style={styles.categoryEmoji}>
        {icon}
      </Text>
      <Text allowFontScaling={false} numberOfLines={1} style={[styles.categoryText, isLong ? styles.categoryTextLong : null]}>
        {category}
      </Text>
    </View>
  );
}

export function TransactionsScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompact = width < 390;
  const horizontalPadding = clamp(width * 0.052, 16, 24);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: 28 + insets.bottom,
          paddingHorizontal: horizontalPadding
        }
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.searchRow}>
        <LinearGradient
          colors={[colors.surface, colors.surfaceSoft]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.searchCard}
        >
          <View style={styles.searchLead}>
            <Ionicons color={colors.textSecondary} name="search-outline" size={isCompact ? 25 : 28} />
          </View>
          <Text allowFontScaling={false} style={styles.searchPlaceholder}>
            Search
          </Text>
        </LinearGradient>

        <Pressable style={styles.filterButton}>
          <MaterialCommunityIcons color={colors.textPrimary} name="tune-variant" size={22} />
        </Pressable>
      </View>

      <Pressable style={styles.addCard}>
        <View style={styles.addIconWrap}>
          <Ionicons color={colors.accentSoft} name="add" size={16} />
        </View>
        <Text allowFontScaling={false} style={styles.addCardText}>
          Add new transaction
        </Text>
      </Pressable>

      {transactionGroups.map((group) => (
        <View key={group.label} style={styles.groupCard}>
          <Text
            allowFontScaling={false}
            style={[styles.groupLabel, group.tone === 'today' ? styles.groupLabelToday : null]}
          >
            {group.label}
          </Text>

          {group.transactions.map((item, index) => (
            <View
              key={`${group.label}-${item.merchant}-${index}`}
              style={[
                styles.transactionRow,
                index < group.transactions.length - 1 ? styles.transactionRowDivider : null
              ]}
            >
              <Text allowFontScaling={false} numberOfLines={2} style={styles.merchant}>
                {item.merchant}
              </Text>

              <View style={styles.transactionRight}>
                <CategoryPill
                  category={item.category}
                  icon={item.categoryIcon}
                  pillColor={item.pillColor}
                />
                <Text allowFontScaling={false} style={styles.amount}>
                  {amountText(item)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 6
  },
  searchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 18
  },
  searchCard: {
    alignItems: 'center',
    borderColor: colors.borderSoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    minHeight: 66,
    paddingHorizontal: 20
  },
  searchLead: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    width: 32
  },
  searchPlaceholder: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 18.5,
    letterSpacing: 0.2
  },
  filterButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderSoft,
    borderRadius: 18,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    marginLeft: 10,
    width: 50
  },
  addCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderColor: colors.borderSoft,
    borderRadius: 22,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 28,
    minHeight: 84
  },
  addIconWrap: {
    alignItems: 'center',
    backgroundColor: colors.accentMuted,
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    marginRight: 12,
    width: 28
  },
  addCardText: {
    color: colors.accentSoft,
    fontFamily: fonts.medium,
    fontSize: 14.2
  },
  groupCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderColor: colors.borderSoft,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  groupLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 9.4,
    letterSpacing: 0.85,
    marginBottom: 12
  },
  groupLabelToday: {
    fontSize: 12.8,
    letterSpacing: 0
  },
  transactionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 10
  },
  transactionRowDivider: {
    borderBottomColor: colors.divider,
    borderBottomWidth: 1
  },
  merchant: {
    color: colors.textPrimary,
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 13.2,
    lineHeight: 18,
    paddingRight: 10
  },
  transactionRight: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0
  },
  categoryPill: {
    alignItems: 'center',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 28,
    paddingHorizontal: 10
  },
  categoryPillLong: {
    paddingHorizontal: 9
  },
  categoryEmoji: {
    fontSize: 14,
    marginRight: 8
  },
  categoryText: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 8.4,
    textTransform: 'uppercase'
  },
  categoryTextLong: {
    fontSize: 7.3
  },
  amount: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 10.2,
    marginLeft: 12,
    minWidth: 72,
    textAlign: 'right'
  }
});
