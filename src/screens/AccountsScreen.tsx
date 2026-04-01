import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InvestmentTrendChart } from '../components/charts/InvestmentTrendChart';
import {
  accountOverviewSnapshots,
  creditCards,
  creditCardsTotalLabel,
  depositoryAccounts,
  depositoryTotalLabel,
  investmentRanges,
  type RangeKey
} from '../data/accounts';
import { clamp, colors, fonts, formatCurrency, radii, shadows } from '../theme';

function formatCurrencyFixed(amount: number) {
  return `₹ ${amount.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  })}`;
}

function AccountsSectionHeader({
  actionLabel,
  totalLabel,
  title
}: {
  actionLabel: string;
  title: string;
  totalLabel: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <Ionicons color={colors.textMuted} name="caret-up" size={14} />
        <Text allowFontScaling={false} style={styles.sectionTitle}>
          {title}
        </Text>
        <Text allowFontScaling={false} style={styles.sectionTotal}>
          {totalLabel}
        </Text>
      </View>
      <Text allowFontScaling={false} style={styles.sectionAction}>
        {actionLabel}
      </Text>
    </View>
  );
}

export function AccountsScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [activeRange, setActiveRange] = useState<RangeKey>('3M');
  const snapshot = accountOverviewSnapshots[activeRange];
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
      <View style={styles.heroShell}>
        <View style={styles.heroCard}>
          <Ionicons color={colors.accentMuted} name="settings-sharp" size={22} style={styles.heroIcon} />

          <View style={styles.heroSummaryRow}>
            <View style={styles.summaryBlock}>
              <Text allowFontScaling={false} style={styles.summaryValue}>
                {formatCurrency(snapshot.assets)}
              </Text>
              <Text allowFontScaling={false} style={styles.summaryLabel}>
                in assets
              </Text>
            </View>

            <View style={styles.summaryBlock}>
              <Text allowFontScaling={false} style={styles.summaryValue}>
                {formatCurrency(snapshot.debt)}
              </Text>
              <Text allowFontScaling={false} style={styles.summaryLabel}>
                in debt
              </Text>
            </View>
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

      <AccountsSectionHeader actionLabel="add >" title="Credit Cards" totalLabel={creditCardsTotalLabel} />
      {creditCards.map((card) => (
        <View key={card.brand} style={styles.instrumentRow}>
          <View style={[styles.instrumentCard, { backgroundColor: card.visualColor }]}>
            <Text allowFontScaling={false} style={styles.instrumentBrand}>
              {card.brand}
            </Text>
            <Text allowFontScaling={false} style={styles.instrumentLabel}>
              {card.label}
            </Text>
          </View>

          <View style={styles.metricsWrap}>
            <View style={styles.metricsColumns}>
              <View style={styles.metricColumn}>
                <Text allowFontScaling={false} style={styles.metricHeading}>
                  BALANCE
                </Text>
                <Text allowFontScaling={false} style={styles.metricValue}>
                  {formatCurrencyFixed(card.balance)}
                </Text>
              </View>
              <View style={styles.metricColumnRight}>
                <Text allowFontScaling={false} style={styles.metricHeading}>
                  UTILIZED
                </Text>
                <Text allowFontScaling={false} style={styles.metricValue}>
                  {card.utilizedLabel}
                </Text>
              </View>
            </View>
          </View>
        </View>
      ))}

      <AccountsSectionHeader actionLabel="add >" title="Depository" totalLabel={depositoryTotalLabel} />
      {depositoryAccounts.map((account) => (
        <View key={account.name} style={styles.instrumentRow}>
          <View style={[styles.instrumentCard, { backgroundColor: account.visualColor }, styles.depositoryCard]}>
            <Text allowFontScaling={false} style={styles.instrumentBrand}>
              {account.name}
            </Text>
            <Text allowFontScaling={false} style={styles.instrumentLabel}>
              {account.label}
            </Text>
          </View>

          <View style={styles.metricsWrap}>
            <View style={styles.metricsColumns}>
              <View style={styles.metricColumn}>
                <Text allowFontScaling={false} style={styles.metricHeading}>
                  CURRENT
                </Text>
                <Text allowFontScaling={false} style={styles.metricValue}>
                  {formatCurrencyFixed(account.current)}
                </Text>
              </View>
              <View style={styles.metricColumnRight}>
                <Text allowFontScaling={false} style={styles.metricHeading}>
                  CHANGE
                </Text>
                <Text allowFontScaling={false} style={styles.metricValue}>
                  {account.changeLabel}
                </Text>
              </View>
            </View>
          </View>
        </View>
      ))}
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
  heroIcon: {
    position: 'absolute',
    right: 18,
    top: 18
  },
  heroSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: 40
  },
  summaryBlock: {
    minWidth: 124
  },
  summaryValue: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 22
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 8.9,
    marginTop: 4
  },
  heroChartWrap: {
    marginTop: 10,
    paddingHorizontal: 2
  },
  rangeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
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
    marginBottom: 12
  },
  sectionHeaderLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 11.2,
    marginLeft: 6
  },
  sectionTotal: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 11,
    marginLeft: 16
  },
  sectionAction: {
    color: colors.accent,
    fontFamily: fonts.medium,
    fontSize: 10.8
  },
  instrumentRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 16
  },
  instrumentCard: {
    borderRadius: 20,
    flex: 0.92,
    minHeight: 146,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  depositoryCard: {
    minHeight: 126
  },
  instrumentBrand: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 14
  },
  instrumentLabel: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 10,
    marginTop: 'auto'
  },
  metricsWrap: {
    flex: 1.18,
    marginLeft: 16
  },
  metricsColumns: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  metricColumn: {
    flex: 1
  },
  metricColumnRight: {
    alignItems: 'flex-end',
    flex: 0.9
  },
  metricHeading: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 9.8
  },
  metricValue: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 10.4,
    marginTop: 10
  }
});
