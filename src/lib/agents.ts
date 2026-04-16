import { type CategoryBudgetItem } from '../data/categories';
import { type TransactionGroup, type TransactionItem } from '../data/transactions';
import { inferCategoryLabel } from './transactions';

export type AgentSeverity = 'critical' | 'warning' | 'info' | 'good';

export type AgentActionTarget =
  | 'Accounts'
  | 'Categories'
  | 'Dashboard'
  | 'Investments'
  | 'Recurring'
  | 'Transactions';

export type AgentInsight = {
  actionLabel: string;
  actionTarget: AgentActionTarget;
  agentName: string;
  confidence: number;
  detail: string;
  id: string;
  severity: AgentSeverity;
  summary: string;
  title: string;
};

export type AgentSnapshot = {
  budgetPressureCount: number;
  criticalCount: number;
  monthlyInflow: number;
  monthlyOutflow: number;
  netFlow: number;
};

export type AgentLineupItem = {
  description: string;
  id: string;
  name: string;
  status: 'learning' | 'live' | 'planned';
};

export type AgentEngineResult = {
  insights: AgentInsight[];
  snapshot: AgentSnapshot;
};

type BuildAgentEngineInput = {
  categoryBudgetItems: CategoryBudgetItem[];
  spentByCategory: Record<string, number>;
  transactionGroups: TransactionGroup[];
};

type FlatTransaction = {
  amount: number;
  category: string;
  merchant: string;
  sourceLabel: string;
};

type SeverityWeight = Record<AgentSeverity, number>;

const severityWeight: SeverityWeight = {
  critical: 0,
  warning: 1,
  info: 2,
  good: 3
};

export const agentLineup: AgentLineupItem[] = [
  {
    description: 'Monitors category burn rate and warns before or after overspend.',
    id: 'budget-guard',
    name: 'Budget Guard',
    status: 'live'
  },
  {
    description: 'Tracks inflow versus outflow to flag runway pressure early.',
    id: 'cashflow-watcher',
    name: 'Cashflow Watcher',
    status: 'live'
  },
  {
    description: 'Suggests better category assignments from merchant patterns.',
    id: 'merchant-mapper',
    name: 'Merchant Mapper',
    status: 'live'
  },
  {
    description: 'Flags unusually large debits compared to your normal spend pattern.',
    id: 'anomaly-radar',
    name: 'Anomaly Radar',
    status: 'learning'
  },
  {
    description: 'Converts repeating merchant charges into recurring controls.',
    id: 'recurring-converter',
    name: 'Recurring Converter',
    status: 'learning'
  },
  {
    description: 'Creates weekly actions to move you toward savings goals automatically.',
    id: 'goal-coach',
    name: 'Goal Coach',
    status: 'planned'
  },
  {
    description: 'Forecasts assets and debt trend under multiple spending scenarios.',
    id: 'net-worth-forecaster',
    name: 'Net Worth Forecaster',
    status: 'planned'
  }
];

function normalizeLabel(value: string) {
  return value.trim().toLowerCase();
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function formatCurrency(amount: number) {
  return `₹ ${amount.toLocaleString('en-IN', {
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2
  })}`;
}

function flattenTransactions(groups: TransactionGroup[]) {
  const flat: FlatTransaction[] = [];

  groups.forEach((group) => {
    group.transactions.forEach((transaction) => {
      flat.push({
        amount: Math.abs(transaction.amount),
        category: transaction.category,
        merchant: transaction.merchant,
        sourceLabel: group.label
      });
    });
  });

  return flat;
}

function isIncomeTransaction(item: TransactionItem) {
  const category = normalizeLabel(item.category);

  if (category === 'income' || category === 'salary') {
    return true;
  }

  return Boolean(item.amountLabel?.trim().startsWith('+₹'));
}

function median(values: number[]) {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function pushBudgetGuardInsight({
  insights,
  pressureItems
}: {
  insights: AgentInsight[];
  pressureItems: Array<{
    budget: number;
    name: string;
    ratio: number;
    spent: number;
  }>;
}) {
  const overspent = pressureItems
    .filter((item) => item.ratio > 1)
    .sort((left, right) => right.ratio - left.ratio);

  if (overspent.length) {
    const strongest = overspent[0];
    const overBy = strongest.spent - strongest.budget;

    insights.push({
      actionLabel: 'Rebalance budget',
      actionTarget: 'Categories',
      agentName: 'Budget Guard',
      confidence: 0.95,
      detail: `${strongest.name} is over by ${formatCurrency(overBy)}. Rebalance or reduce this lane first.`,
      id: 'budget-overspend',
      severity: 'critical',
      summary: `${formatCurrency(strongest.spent)} spent of ${formatCurrency(strongest.budget)} assigned.`,
      title: `${strongest.name} crossed budget limit`
    });
    return;
  }

  const nearLimit = pressureItems
    .filter((item) => item.ratio >= 0.85)
    .sort((left, right) => right.ratio - left.ratio);

  if (!nearLimit.length) {
    return;
  }

  const strongest = nearLimit[0];
  const remaining = Math.max(strongest.budget - strongest.spent, 0);

  insights.push({
    actionLabel: 'Open categories',
    actionTarget: 'Categories',
    agentName: 'Budget Guard',
    confidence: 0.9,
    detail: `${strongest.name} has only ${formatCurrency(remaining)} left this month.`,
    id: 'budget-near-limit',
    severity: 'warning',
    summary: `${Math.round(strongest.ratio * 100)}% budget used in ${strongest.name}.`,
    title: `${strongest.name} is close to budget cap`
  });
}

function pushCashflowInsight({
  groups,
  insights
}: {
  groups: TransactionGroup[];
  insights: AgentInsight[];
}) {
  let inflow = 0;
  let outflow = 0;

  groups.forEach((group) => {
    group.transactions.forEach((transaction) => {
      if (isIncomeTransaction(transaction)) {
        inflow += Math.abs(transaction.amount);
      } else {
        outflow += Math.abs(transaction.amount);
      }
    });
  });

  if (outflow <= 0) {
    return;
  }

  const roundedOutflow = roundMoney(outflow);
  const roundedInflow = roundMoney(inflow);
  const netFlow = roundMoney(inflow - outflow);

  if (roundedInflow <= 0) {
    insights.push({
      actionLabel: 'Review accounts',
      actionTarget: 'Accounts',
      agentName: 'Cashflow Watcher',
      confidence: 0.72,
      detail: 'No income entries are detected in current transaction history. Add credits to improve runway clarity.',
      id: 'cashflow-no-inflow',
      severity: 'warning',
      summary: `${formatCurrency(roundedOutflow)} outflow tracked with no inflow in view.`,
      title: 'Cashflow visibility is incomplete'
    });
    return;
  }

  if (netFlow < 0) {
    insights.push({
      actionLabel: 'Open dashboard',
      actionTarget: 'Dashboard',
      agentName: 'Cashflow Watcher',
      confidence: 0.86,
      detail: `Outflow is exceeding inflow by ${formatCurrency(Math.abs(netFlow))}.`,
      id: 'cashflow-negative',
      severity: 'warning',
      summary: `${formatCurrency(roundedInflow)} in vs ${formatCurrency(roundedOutflow)} out.`,
      title: 'Net monthly cashflow is negative'
    });
    return;
  }

  insights.push({
    actionLabel: 'See dashboard',
    actionTarget: 'Dashboard',
    agentName: 'Cashflow Watcher',
    confidence: 0.8,
    detail: `You currently hold a positive net flow of ${formatCurrency(netFlow)} this month.`,
    id: 'cashflow-positive',
    severity: 'good',
    summary: `${formatCurrency(roundedInflow)} inflow is ahead of ${formatCurrency(roundedOutflow)} outflow.`,
    title: 'Cashflow is in healthy range'
  });
}

function pushMerchantMapperInsight({
  insights,
  transactions
}: {
  insights: AgentInsight[];
  transactions: FlatTransaction[];
}) {
  const mismatched = transactions
    .map((transaction) => {
      const current = normalizeLabel(transaction.category);
      const suggested = inferCategoryLabel(transaction.merchant);
      const suggestedNormalized = normalizeLabel(suggested);

      if (!current || suggestedNormalized === current || suggestedNormalized === 'other') {
        return null;
      }

      return {
        current: transaction.category,
        merchant: transaction.merchant,
        suggested
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (!mismatched.length) {
    return;
  }

  const exampleLines = mismatched
    .slice(0, 3)
    .map((item) => `${item.merchant}: ${item.current} → ${item.suggested}`)
    .join(' • ');

  insights.push({
    actionLabel: 'Open transactions',
    actionTarget: 'Transactions',
    agentName: 'Merchant Mapper',
    confidence: 0.77,
    detail: `Suggested recategorization examples: ${exampleLines}`,
    id: 'merchant-mapper-mismatch',
    severity: 'info',
    summary: `${mismatched.length} transaction${mismatched.length > 1 ? 's' : ''} can be categorized better.`,
    title: 'Category quality can be improved'
  });
}

function pushAnomalyInsight({
  insights,
  transactions
}: {
  insights: AgentInsight[];
  transactions: FlatTransaction[];
}) {
  const debits = transactions.filter((transaction) => normalizeLabel(transaction.category) !== 'income');

  if (debits.length < 5) {
    return;
  }

  const values = debits.map((transaction) => transaction.amount);
  const baseline = median(values);
  const largest = debits.sort((left, right) => right.amount - left.amount)[0];

  if (!largest) {
    return;
  }

  const threshold = Math.max(900, baseline * 1.9);

  if (largest.amount < threshold) {
    return;
  }

  insights.push({
    actionLabel: 'Inspect transaction',
    actionTarget: 'Transactions',
    agentName: 'Anomaly Radar',
    confidence: 0.74,
    detail: `${largest.merchant} at ${formatCurrency(largest.amount)} is high versus your median spend of ${formatCurrency(baseline)}.`,
    id: 'anomaly-largest-spend',
    severity: 'warning',
    summary: `Largest debit in ${largest.sourceLabel} crossed anomaly threshold.`,
    title: 'Unusual spend detected'
  });
}

function pushRecurringInsight({
  insights,
  transactions
}: {
  insights: AgentInsight[];
  transactions: FlatTransaction[];
}) {
  const merchantCount = new Map<string, { display: string; total: number }>();

  transactions.forEach((transaction) => {
    if (normalizeLabel(transaction.category) === 'income') {
      return;
    }

    const key = normalizeLabel(transaction.merchant).replace(/[^a-z0-9 ]+/g, ' ');

    if (!key || key.length < 3) {
      return;
    }

    const current = merchantCount.get(key) ?? {
      display: transaction.merchant,
      total: 0
    };
    current.total += 1;
    merchantCount.set(key, current);
  });

  const repeated = Array.from(merchantCount.entries())
    .filter(([, value]) => value.total >= 2)
    .sort((left, right) => right[1].total - left[1].total);

  if (!repeated.length) {
    return;
  }

  const [merchantKey, merchantValue] = repeated[0];

  insights.push({
    actionLabel: 'Move to recurring',
    actionTarget: 'Recurring',
    agentName: 'Recurring Converter',
    confidence: 0.71,
    detail: `${merchantValue.display} appears ${merchantValue.total} times in recent history and looks recurring.`,
    id: `recurring-candidate-${merchantKey}`,
    severity: 'info',
    summary: 'Automating this will improve predictability in monthly planning.',
    title: `Potential recurring pattern detected`
  });
}

export function buildAgentEngineResult({
  categoryBudgetItems,
  spentByCategory,
  transactionGroups
}: BuildAgentEngineInput): AgentEngineResult {
  const flatTransactions = flattenTransactions(transactionGroups);
  const insights: AgentInsight[] = [];
  const trackableBudgetItems = categoryBudgetItems.filter((item) => !item.isGroup);
  const budgetPressureItems = trackableBudgetItems
    .filter((item) => item.budget > 0)
    .map((item) => {
      const spent = spentByCategory[normalizeLabel(item.name)] ?? item.spent;
      const ratio = item.budget > 0 ? spent / item.budget : 0;

      return {
        budget: item.budget,
        name: item.name,
        ratio,
        spent
      };
    })
    .filter((item) => item.ratio >= 0.85);

  pushBudgetGuardInsight({
    insights,
    pressureItems: budgetPressureItems
  });
  pushCashflowInsight({
    groups: transactionGroups,
    insights
  });
  pushMerchantMapperInsight({
    insights,
    transactions: flatTransactions
  });
  pushAnomalyInsight({
    insights,
    transactions: flatTransactions
  });
  pushRecurringInsight({
    insights,
    transactions: flatTransactions
  });

  if (!insights.length) {
    insights.push({
      actionLabel: 'Open dashboard',
      actionTarget: 'Dashboard',
      agentName: 'Agent Orchestrator',
      confidence: 0.84,
      detail: 'No major financial anomalies are detected right now. Keep tracking to unlock more guidance.',
      id: 'all-stable',
      severity: 'good',
      summary: 'Your current data pattern looks stable.',
      title: 'No critical risks found'
    });
  }

  const sortedInsights = [...insights]
    .sort((left, right) => {
      const leftWeight = severityWeight[left.severity];
      const rightWeight = severityWeight[right.severity];

      if (leftWeight !== rightWeight) {
        return leftWeight - rightWeight;
      }

      return right.confidence - left.confidence;
    })
    .slice(0, 6);

  const monthlyInflow = transactionGroups.reduce((sum, group) => {
    return (
      sum +
      group.transactions.reduce((groupSum, transaction) => {
        if (!isIncomeTransaction(transaction)) {
          return groupSum;
        }

        return groupSum + Math.abs(transaction.amount);
      }, 0)
    );
  }, 0);

  const monthlyOutflow = transactionGroups.reduce((sum, group) => {
    return (
      sum +
      group.transactions.reduce((groupSum, transaction) => {
        if (isIncomeTransaction(transaction)) {
          return groupSum;
        }

        return groupSum + Math.abs(transaction.amount);
      }, 0)
    );
  }, 0);

  const criticalCount = sortedInsights.filter((insight) => insight.severity === 'critical').length;

  return {
    insights: sortedInsights,
    snapshot: {
      budgetPressureCount: budgetPressureItems.length,
      criticalCount,
      monthlyInflow: roundMoney(monthlyInflow),
      monthlyOutflow: roundMoney(monthlyOutflow),
      netFlow: roundMoney(monthlyInflow - monthlyOutflow)
    }
  };
}
