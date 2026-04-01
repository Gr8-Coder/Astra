import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BudgetMixRing } from '../components/charts/BudgetMixRing';
import { categoryBudgetItems, categoriesSummary, type CategoryBudgetItem } from '../data/categories';
import { clamp, colors, fonts, formatCurrency, radii, shadows } from '../theme';

function toneColor(tone: CategoryBudgetItem['tone']) {
  if (tone === 'red') {
    return '#FF1717';
  }

  if (tone === 'orange') {
    return '#D47A58';
  }

  if (tone === 'yellow') {
    return '#F0CB52';
  }

  return '#57B324';
}

function BudgetRow({
  item,
  spentWidth,
  budgetColumnWidth,
  budgetValueWidth,
  width
}: {
  item: CategoryBudgetItem;
  spentWidth: number;
  budgetColumnWidth: number;
  budgetValueWidth: number;
  width: number;
}) {
  const isNarrow = width < 390;
  const ratio = Math.min(item.spent / item.budget, 1);
  const barColor = toneColor(item.tone);
  const indentation = item.level === 1 ? 28 : 0;
  const itemIconSize = item.level === 1 ? 17 : 16;

  return (
    <View style={styles.row}>
      <View style={[styles.nameColumn, { paddingLeft: indentation }]}>
        <View style={[styles.colorDot, { backgroundColor: item.accent }]} />
        <View style={[styles.namePill, item.isGroup ? styles.groupPill : null]}>
          <Ionicons
            color={item.isGroup ? colors.textMuted : colors.textPrimary}
            name={(item.isGroup ? 'caret-up' : item.icon) as any}
            size={item.isGroup ? 14 : itemIconSize}
          />
          <Text
            adjustsFontSizeToFit
            allowFontScaling={false}
            minimumFontScale={0.72}
            numberOfLines={1}
            style={styles.nameText}
          >
            {item.name}
          </Text>
        </View>
      </View>

      <Text
        allowFontScaling={false}
        style={[styles.spentValue, { width: spentWidth }, isNarrow ? styles.valueNarrow : null]}
      >
        {formatCurrency(item.spent)}
      </Text>

      <View style={[styles.budgetColumn, { width: budgetColumnWidth }]}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { backgroundColor: barColor, width: `${ratio * 100}%` }]} />
        </View>
        <Text
          allowFontScaling={false}
          style={[styles.budgetValue, { width: budgetValueWidth }, isNarrow ? styles.valueNarrow : null]}
        >
          {formatCurrency(item.budget)}
        </Text>
      </View>
    </View>
  );
}

export function CategoriesScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const horizontalPadding = clamp(width * 0.055, 16, 26);
  const isNarrow = width < 390;
  const contentWidth = width - horizontalPadding * 2;
  const spentWidth = isNarrow ? 56 : 60;
  const budgetValueWidth = isNarrow ? 46 : 50;
  const budgetColumnWidth = isNarrow ? 128 : 138;

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
        <View style={[styles.summaryCard, isNarrow ? styles.summaryCardNarrow : null]}>
          <View style={styles.summaryBlock}>
            <Text allowFontScaling={false} style={styles.summaryValue}>
              {formatCurrency(categoriesSummary.spent)}
            </Text>
            <Text allowFontScaling={false} style={styles.summaryLabel}>
              spent so far
            </Text>
          </View>

          <View style={styles.summaryRingWrap}>
            <BudgetMixRing size={isNarrow ? 70 : 78} strokeWidth={isNarrow ? 11 : 12} />
          </View>

          <View style={styles.summaryBlock}>
            <Text allowFontScaling={false} style={styles.summaryValue}>
              {formatCurrency(categoriesSummary.totalBudget)}
            </Text>
            <Text allowFontScaling={false} style={styles.summaryLabel}>
              total budget
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.tableHeader}>
        <View style={styles.nameColumn} />
        <Text allowFontScaling={false} style={[styles.tableHeaderText, { width: spentWidth }]}>
          SPENT
        </Text>
        <Text allowFontScaling={false} style={[styles.tableHeaderText, { width: budgetColumnWidth }]}>
          BUDGET
        </Text>
      </View>

      {categoryBudgetItems.map((item) => (
        <BudgetRow
          key={`${item.name}-${item.level ?? 0}`}
          budgetColumnWidth={budgetColumnWidth}
          budgetValueWidth={budgetValueWidth}
          item={item}
          spentWidth={spentWidth}
          width={contentWidth}
        />
      ))}

      <View style={[styles.footerActions, width < 372 ? styles.footerActionsStack : null]}>
        <View style={[styles.actionButtonShell, width < 372 ? styles.actionButtonShellStack : null]}>
          <Text allowFontScaling={false} style={styles.actionButtonText}>
            Add a Category
          </Text>
        </View>

        <View style={[styles.actionButtonShell, width < 372 ? styles.actionButtonShellStack : null]}>
          <Text allowFontScaling={false} style={styles.actionButtonText}>
            Rebalance Budget
          </Text>
        </View>
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
    minHeight: 164,
    paddingHorizontal: 14,
    paddingVertical: 18
  },
  summaryCardNarrow: {
    minHeight: 154,
    paddingHorizontal: 12
  },
  summaryBlock: {
    flex: 1
  },
  summaryRingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8
  },
  summaryValue: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 15.5
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 8.8,
    lineHeight: 12,
    marginTop: 6
  },
  tableHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4
  },
  tableHeaderText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 9.8,
    letterSpacing: 0.8,
    textAlign: 'right',
    width: 84
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 10
  },
  nameColumn: {
    alignItems: 'center',
    flex: 1.9,
    flexDirection: 'row',
    minWidth: 0,
    paddingRight: 8
  },
  colorDot: {
    borderRadius: 9,
    height: 16,
    marginRight: 8,
    width: 16
  },
  namePill: {
    alignItems: 'center',
    backgroundColor: '#123764',
    borderRadius: 999,
    flexDirection: 'row',
    maxWidth: '100%',
    minHeight: 33,
    paddingHorizontal: 10
  },
  groupPill: {
    paddingRight: 14
  },
  nameText: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 8.5,
    marginLeft: 6,
    textTransform: 'uppercase'
  },
  spentValue: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 10.6,
    textAlign: 'right'
  },
  budgetColumn: {
    alignItems: 'center',
    flexDirection: 'row',
    marginLeft: 8
  },
  progressTrack: {
    backgroundColor: '#E5E2E5',
    borderRadius: 999,
    flex: 1,
    height: 12,
    overflow: 'hidden'
  },
  progressFill: {
    borderRadius: 999,
    height: '100%'
  },
  budgetValue: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 10.6,
    marginLeft: 7,
    textAlign: 'right'
  },
  valueNarrow: {
    fontSize: 10.2
  },
  footerActions: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 20
  },
  footerActionsStack: {
    flexDirection: 'column'
  },
  actionButtonShell: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    minHeight: 56,
    ...shadows.card
  },
  actionButtonShellStack: {
    width: '100%'
  },
  actionButtonText: {
    color: colors.accent,
    fontFamily: fonts.semiBold,
    fontSize: 11.8,
    textTransform: 'uppercase'
  }
});
