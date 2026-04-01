import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BudgetTrendChart } from '../components/charts/BudgetTrendChart';
import { DonutProgress } from '../components/charts/DonutProgress';
import { IconOrb } from '../components/ui/IconOrb';
import { SectionHeader } from '../components/ui/SectionHeader';
import {
  budgetSummary,
  categoryBudgets,
  incomeItems,
  upcomingPayments,
  reviewItems
} from '../data/dashboard';
import { clamp, colors, fonts, formatCurrency, radii, shadows } from '../theme';

function chunkItems<T>(items: T[], size: number) {
  const pages: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    pages.push(items.slice(index, index + size));
  }

  return pages;
}

export function DashboardScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompact = width < 380;
  const isPhoneWidth = width < 412;
  const horizontalPadding = clamp(width * 0.052, 16, 24);
  const contentWidth = width - horizontalPadding * 2;
  const categoryPageWidth = contentWidth - 24;
  const categoryPages = chunkItems(categoryBudgets, isPhoneWidth ? 3 : 4);
  const sectionOne = useRef(new Animated.Value(0)).current;
  const sectionTwo = useRef(new Animated.Value(0)).current;
  const sectionThree = useRef(new Animated.Value(0)).current;
  const sectionFour = useRef(new Animated.Value(0)).current;
  const sectionFive = useRef(new Animated.Value(0)).current;
  const categoryPageInterval = categoryPageWidth + 10;

  useEffect(() => {
    const animations = [sectionOne, sectionTwo, sectionThree, sectionFour, sectionFive].map((value) =>
      Animated.spring(value, {
        damping: 18,
        mass: 0.9,
        stiffness: 140,
        toValue: 1,
        useNativeDriver: true
      })
    );

    Animated.stagger(110, animations).start();
  }, [sectionFive, sectionFour, sectionOne, sectionThree, sectionTwo]);

  const createRevealStyle = (value: Animated.Value) => ({
    opacity: value,
    transform: [
      {
        translateY: value.interpolate({
          inputRange: [0, 1],
          outputRange: [26, 0]
        })
      }
    ]
  });

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: 38 + insets.bottom,
          paddingHorizontal: horizontalPadding
        }
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={createRevealStyle(sectionOne)}>
        <View style={styles.cardShell}>
          <View style={styles.heroCard}>
            <Text allowFontScaling={false} style={styles.heroAmount}>
              {formatCurrency(budgetSummary.left)} left
            </Text>
            <Text allowFontScaling={false} style={styles.heroSubcopy}>
              out of {formatCurrency(budgetSummary.totalBudget)} budgeted
            </Text>
            <View style={styles.chartWrap}>
              <BudgetTrendChart height={isCompact ? 148 : 162} />
            </View>
          </View>
        </View>
      </Animated.View>

      <Animated.View style={createRevealStyle(sectionTwo)}>
        <SectionHeader title="To Review" />
        <View style={styles.cardShell}>
          <View style={styles.panel}>
            <Text allowFontScaling={false} style={styles.panelDate}>
              Yesterday
            </Text>

            {reviewItems.map((item, index) => (
              <View
                key={item.merchant}
                style={[styles.reviewRow, index > 0 ? styles.reviewRowSpacing : null]}
              >
                <View style={styles.reviewLeft}>
                  <IconOrb
                    backgroundColor="rgba(255, 255, 255, 0.09)"
                    name={item.merchantIcon}
                    orbSize={30}
                    size={17}
                  />
                  <Text allowFontScaling={false} style={styles.reviewMerchant}>
                    {item.merchant}
                  </Text>
                </View>

                <View style={styles.reviewRight}>
                  <View style={[styles.categoryPill, { backgroundColor: item.pillColor }]}>
                    <IconOrb
                      backgroundColor="rgba(4, 24, 42, 0.25)"
                      name={item.categoryIcon}
                      orbSize={22}
                      size={12}
                    />
                    <Text allowFontScaling={false} style={styles.categoryPillText}>
                      {item.category}
                    </Text>
                  </View>
                  <Text allowFontScaling={false} style={styles.reviewAmount}>
                    {formatCurrency(item.amount)}
                  </Text>
                </View>
              </View>
            ))}

            <Pressable style={styles.reviewButton}>
              <Text allowFontScaling={false} style={styles.reviewButtonText}>
                Mark as reviewed
              </Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>

      <Animated.View style={createRevealStyle(sectionThree)}>
        <SectionHeader title="Categories" />
        <View style={styles.cardShell}>
          <View style={styles.categoriesPanel}>
            <ScrollView
              bounces={false}
              contentContainerStyle={styles.categoryScroller}
              decelerationRate="fast"
              disableIntervalMomentum
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              snapToAlignment="start"
              snapToInterval={categoryPageInterval}
            >
              {categoryPages.map((page, pageIndex) => (
                <View
                  key={`page-${pageIndex}`}
                  style={[
                    styles.categoryPage,
                    {
                      width: categoryPageWidth
                    },
                    pageIndex < categoryPages.length - 1 ? styles.categoryPageSpacing : null
                  ]}
                >
                  {page.map((item, index) => (
                    <View
                      key={item.name}
                      style={index < page.length - 1 ? styles.categoryItemSpacing : null}
                    >
                      <DonutProgress
                        amount={formatCurrency(item.amount)}
                        color={item.color}
                        icon={item.icon}
                        progress={item.usedRatio}
                        size={isPhoneWidth ? 68 : 76}
                        status={item.status}
                      />
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Animated.View>

      <Animated.View style={createRevealStyle(sectionFour)}>
        <SectionHeader title="Upcoming" />
        <ScrollView
          contentContainerStyle={styles.upcomingScroller}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {upcomingPayments.map((payment, index) => (
            <View
              key={payment.service}
              style={[
                styles.upcomingItem,
                {
                  width: isCompact ? 146 : 164
                },
                index < upcomingPayments.length - 1 ? styles.upcomingSpacing : null
              ]}
            >
              <Text allowFontScaling={false} style={styles.upcomingDue}>
                {payment.dueIn}
              </Text>
              <View style={styles.upcomingCard}>
                <View style={[styles.upcomingBadge, { backgroundColor: payment.accent }]}>
                  <Ionicons color={colors.textPrimary} name={payment.icon as any} size={15} />
                </View>
                <Text allowFontScaling={false} style={styles.upcomingService}>
                  {payment.service}
                </Text>
                <Text allowFontScaling={false} style={styles.upcomingAmount}>
                  {formatCurrency(payment.amount)}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </Animated.View>

      <Animated.View style={createRevealStyle(sectionFive)}>
        <SectionHeader title="Income" />
        <ScrollView
          contentContainerStyle={styles.incomeScroller}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {incomeItems.map((item, index) => (
            <View
              key={item.source}
              style={[
                styles.incomeCard,
                index < incomeItems.length - 1 ? styles.upcomingSpacing : null
              ]}
            >
              <View style={[styles.incomeIcon, { backgroundColor: item.accent }]}>
                <Ionicons color={colors.textPrimary} name={item.icon as any} size={18} />
              </View>
              <View>
                <Text allowFontScaling={false} style={styles.incomeSource}>
                  {item.source}
                </Text>
                <Text allowFontScaling={false} style={styles.incomeAmount}>
                  {formatCurrency(item.amount)}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 4
  },
  cardShell: {
    borderRadius: radii.xl,
    marginBottom: 22,
    ...shadows.card
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: radii.xl,
    borderWidth: 1,
    minHeight: 286,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingTop: 18
  },
  heroAmount: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 19.5,
    textAlign: 'center'
  },
  heroSubcopy: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 11.5,
    marginTop: 10,
    textAlign: 'center'
  },
  chartWrap: {
    marginTop: 14
  },
  panel: {
    backgroundColor: colors.surfacePanel,
    borderColor: colors.borderSoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    minHeight: 188,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14
  },
  categoriesPanel: {
    backgroundColor: colors.surfacePanel,
    borderColor: colors.borderSoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    minHeight: 164,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  panelDate: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    marginBottom: 14,
    textAlign: 'center'
  },
  reviewRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  reviewLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1
  },
  reviewRowSpacing: {
    marginTop: 12
  },
  reviewMerchant: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 10.5,
    flexShrink: 1,
    marginLeft: 10,
    paddingRight: 10
  },
  reviewRight: {
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
    minHeight: 30,
    paddingBottom: 4,
    paddingLeft: 4,
    paddingRight: 10,
    paddingTop: 4
  },
  categoryPillText: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 9.6,
    marginLeft: 7
  },
  reviewAmount: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 10.5,
    marginLeft: 8
  },
  reviewButton: {
    alignItems: 'center',
    marginTop: 18
  },
  reviewButtonText: {
    color: colors.accent,
    fontFamily: fonts.semiBold,
    fontSize: 9.8,
    letterSpacing: 0.25,
    textTransform: 'uppercase'
  },
  categoryScroller: {
    paddingVertical: 4
  },
  categoryPage: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  categoryPageSpacing: {
    marginRight: 10
  },
  categoryItemSpacing: {
    marginRight: 8
  },
  upcomingScroller: {
    paddingBottom: 4
  },
  upcomingItem: {
    justifyContent: 'flex-start'
  },
  upcomingCard: {
    alignItems: 'center',
    backgroundColor: colors.surfacePanel,
    borderColor: colors.borderSoft,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 38,
    paddingHorizontal: 10
  },
  upcomingSpacing: {
    marginRight: 10
  },
  upcomingDue: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 8.8,
    letterSpacing: 0.3,
    marginBottom: 6,
    textTransform: 'lowercase'
  },
  upcomingBadge: {
    alignItems: 'center',
    borderRadius: 999,
    height: 22,
    justifyContent: 'center',
    marginRight: 8,
    width: 22
  },
  upcomingService: {
    color: colors.textPrimary,
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 8.8
  },
  upcomingAmount: {
    color: colors.accent,
    fontFamily: fonts.semiBold,
    fontSize: 9
  },
  incomeScroller: {
    paddingBottom: 2
  },
  incomeCard: {
    alignItems: 'center',
    backgroundColor: colors.surfacePanel,
    borderColor: colors.borderSoft,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    minWidth: 146,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  incomeIcon: {
    alignItems: 'center',
    borderRadius: 13,
    height: 26,
    justifyContent: 'center',
    marginRight: 10,
    width: 26
  },
  incomeSource: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 8.6,
    marginBottom: 2
  },
  incomeAmount: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 11
  }
});
