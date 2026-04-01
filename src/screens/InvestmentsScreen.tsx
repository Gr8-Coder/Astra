import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InvestmentTrendChart } from '../components/charts/InvestmentTrendChart';
import { SparklineChart } from '../components/charts/SparklineChart';
import {
  investmentRanges,
  linkedAccounts,
  portfolioSnapshots,
  topMovers,
  type RangeKey
} from '../data/investments';
import { clamp, colors, fonts, formatCurrency, radii, shadows } from '../theme';

function chunkItems<T>(items: T[], size: number) {
  const pages: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    pages.push(items.slice(index, index + size));
  }

  return pages;
}

function SectionLabel({
  title,
  action
}: {
  action?: string;
  title: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <Ionicons color={colors.textMuted} name="caret-up" size={14} />
        <Text allowFontScaling={false} style={styles.sectionTitle}>
          {title}
        </Text>
      </View>
      {action ? (
        <Text allowFontScaling={false} style={styles.sectionAction}>
          {action}
        </Text>
      ) : null}
    </View>
  );
}

export function InvestmentsScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [activeRange, setActiveRange] = useState<RangeKey>('3M');
  const snapshot = portfolioSnapshots[activeRange];
  const horizontalPadding = clamp(width * 0.052, 16, 24);
  const contentWidth = width - horizontalPadding * 2;
  const moversCardWidth = Math.max(146, Math.min(164, contentWidth * 0.46));
  const moversViewportWidth = contentWidth;
  const moversPages = chunkItems(topMovers, 2);
  const moversPageInterval = moversViewportWidth + 10;

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
      <View style={styles.heroShell}>
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <Text allowFontScaling={false} style={styles.performanceValue}>
              {snapshot.performanceLabel}
            </Text>
            <Ionicons color={colors.accentMuted} name="settings-sharp" size={22} />
          </View>

          <Text allowFontScaling={false} style={styles.balanceValue}>
            {formatCurrency(snapshot.balance)}
          </Text>
          <View style={styles.balanceLabelRow}>
            <Text allowFontScaling={false} style={styles.balanceLabel}>
              {snapshot.label}
            </Text>
            <Ionicons color={colors.textMuted} name="help-circle-outline" size={16} />
          </View>

          <View style={styles.heroChartWrap}>
            <InvestmentTrendChart points={snapshot.points} />
          </View>

          <View style={styles.rangeRow}>
            {investmentRanges.map((range) => {
              const isActive = range === activeRange;

              return (
                <Pressable
                  key={range}
                  onPress={() => setActiveRange(range)}
                  style={[styles.rangeChip, isActive ? styles.rangeChipActive : null]}
                >
                  <Text allowFontScaling={false} style={[styles.rangeLabel, isActive ? styles.rangeLabelActive : null]}>
                    {range}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <SectionLabel action="Last Price" title="Your top movers today" />
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.moversScroller}
        decelerationRate="fast"
        disableIntervalMomentum
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={moversPageInterval}
      >
        {moversPages.map((page, pageIndex) => (
          <View
            key={`movers-${pageIndex}`}
            style={[
              styles.moversPage,
              { width: moversViewportWidth },
              pageIndex < moversPages.length - 1 ? styles.moversPageSpacing : null
            ]}
          >
            {page.map((mover, index) => {
              const isPositive = mover.direction === 'up';

              return (
                <View
                  key={mover.symbol}
                  style={[
                    styles.moverCard,
                    { width: moversCardWidth },
                    index < page.length - 1 ? styles.moverCardSpacing : null
                  ]}
                >
                  <Text allowFontScaling={false} style={styles.moverSymbol}>
                    {mover.symbol}
                  </Text>
                  <View style={styles.moverChartWrap}>
                    <SparklineChart
                      color={isPositive ? colors.positive : '#E43B31'}
                      height={74}
                      points={mover.points}
                    />
                  </View>
                  <Text allowFontScaling={false} style={[styles.moverChange, isPositive ? styles.positiveText : styles.negativeText]}>
                    {mover.changeLabel}
                  </Text>
                </View>
              );
            })}
            {page.length === 1 ? <View style={[styles.moverCardGhost, { width: moversCardWidth }]} /> : null}
          </View>
        ))}
      </ScrollView>

      <SectionLabel action="3M Return" title="Accounts" />
      {linkedAccounts.map((account) => {
        const isPositive = account.direction === 'up';

        return (
          <View key={account.app} style={styles.accountRow}>
            <Text allowFontScaling={false} style={styles.accountName}>
              {account.app}
            </Text>
            <View style={styles.accountTrendWrap}>
              <SparklineChart
                color={isPositive ? colors.positive : '#E43B31'}
                height={36}
                points={account.points}
                width={116}
              />
            </View>
            <Text allowFontScaling={false} style={[styles.accountChange, isPositive ? styles.positiveText : styles.negativeText]}>
              {account.changeLabel}
            </Text>
          </View>
        );
      })}

      <SectionLabel title="Allocation" />
      <Pressable style={styles.allocationCard}>
        <Ionicons color={colors.textPrimary} name="add" size={22} />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 6
  },
  heroShell: {
    borderRadius: radii.xl,
    marginBottom: 26,
    ...shadows.card
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16
  },
  heroTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  performanceValue: {
    color: colors.positive,
    fontFamily: fonts.medium,
    fontSize: 10.6
  },
  balanceValue: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 22,
    textAlign: 'center'
  },
  balanceLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 2
  },
  balanceLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 8.9,
    marginRight: 6
  },
  heroChartWrap: {
    marginTop: 10,
    paddingHorizontal: 4
  },
  rangeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 8
  },
  rangeChip: {
    alignItems: 'center',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 34,
    minWidth: 46,
    paddingHorizontal: 10
  },
  rangeChipActive: {
    backgroundColor: colors.surfaceSoft
  },
  rangeLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 8.8
  },
  rangeLabelActive: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14
  },
  sectionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row'
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 11.2,
    marginLeft: 6
  },
  sectionAction: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 10
  },
  moversScroller: {
    paddingBottom: 6
  },
  moversPage: {
    flexDirection: 'row'
  },
  moversPageSpacing: {
    marginRight: 10
  },
  moverCard: {
    backgroundColor: colors.surfacePanel,
    borderColor: colors.borderSoft,
    borderRadius: 22,
    borderWidth: 1,
    minHeight: 174,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12
  },
  moverCardSpacing: {
    marginRight: 12
  },
  moverCardGhost: {
    opacity: 0
  },
  moverSymbol: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 13.2
  },
  moverChartWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  },
  moverChange: {
    fontFamily: fonts.medium,
    fontSize: 10.6,
    textAlign: 'center'
  },
  positiveText: {
    color: colors.positive
  },
  negativeText: {
    color: '#E43B31'
  },
  accountRow: {
    alignItems: 'center',
    backgroundColor: colors.surfacePanel,
    borderColor: colors.borderSoft,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 54,
    paddingHorizontal: 14,
    marginBottom: 10
  },
  accountName: {
    color: colors.textPrimary,
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12.8
  },
  accountTrendWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10
  },
  accountChange: {
    fontFamily: fonts.medium,
    fontSize: 10.2,
    minWidth: 58,
    textAlign: 'right'
  },
  allocationCard: {
    alignItems: 'center',
    backgroundColor: colors.surfacePanel,
    borderColor: colors.borderSoft,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 54
  }
});
