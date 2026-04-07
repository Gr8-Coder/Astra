import { budgetSummary, categoryBudgets, type CategoryBudget } from '../data/dashboard';
import { inferCategoryLabel } from './transactions';
import { monthRangeForQueries } from './categories';
import { supabase } from './supabase';

type DbTransactionSummaryRow = {
  amount: number | string;
  direction: 'credit' | 'debit' | 'transfer' | null;
  merchant_name: string;
  metadata: Record<string, unknown> | null;
};

type DbCategoryRow = {
  accent_color: string | null;
  icon: string | null;
  id: string;
  name: string;
  parent_id: string | null;
};

type DbBudgetRow = {
  assigned_amount: number | string;
  category_id: string;
};

type DashboardBudgetSummary = {
  left: number;
  totalBudget: number;
  underAmount: number;
};

type DashboardSnapshot = {
  budgetSummary: DashboardBudgetSummary;
  categoryBudgets: CategoryBudget[];
};

function toNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizedCategory(value: string) {
  return value.trim().toLowerCase();
}

function extractCategoryLabel(row: DbTransactionSummaryRow) {
  const metadata = row.metadata ?? {};
  const metadataCategory =
    typeof metadata.category_label === 'string' ? metadata.category_label.trim() : '';

  if (metadataCategory) {
    return metadataCategory;
  }

  return inferCategoryLabel(row.merchant_name);
}

async function loadCurrentMonthTransactions(userId: string) {
  const range = monthRangeForQueries();
  const { data, error } = await supabase
    .from('transactions')
    .select('amount, direction, merchant_name, metadata')
    .eq('user_id', userId)
    .gte('booked_at', `${range.start}T00:00:00.000Z`)
    .lte('booked_at', `${range.end}T23:59:59.999Z`);

  if (error) {
    throw error;
  }

  return (data as DbTransactionSummaryRow[] | null) ?? [];
}

async function loadUserCategories(userId: string) {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, icon, accent_color, parent_id')
    .eq('user_id', userId)
    .eq('is_system', false);

  if (error) {
    throw error;
  }

  return (data as DbCategoryRow[] | null) ?? [];
}

async function loadCurrentMonthBudgets({
  categoryIds,
  userId
}: {
  categoryIds: string[];
  userId: string;
}) {
  if (!categoryIds.length) {
    return [];
  }

  const range = monthRangeForQueries();
  const { data, error } = await supabase
    .from('budgets')
    .select('category_id, assigned_amount')
    .eq('user_id', userId)
    .eq('period_start', range.start)
    .eq('period_end', range.end)
    .in('category_id', categoryIds);

  if (error) {
    throw error;
  }

  return (data as DbBudgetRow[] | null) ?? [];
}

export async function loadCurrentMonthCategorySpendMap(userId: string) {
  const transactions = await loadCurrentMonthTransactions(userId);
  const spentByCategory: Record<string, number> = {};

  transactions.forEach((transaction) => {
    if (transaction.direction && transaction.direction !== 'debit') {
      return;
    }

    const category = extractCategoryLabel(transaction);
    const key = normalizedCategory(category);

    if (!key) {
      return;
    }

    spentByCategory[key] = (spentByCategory[key] ?? 0) + toNumber(transaction.amount);
  });

  return Object.entries(spentByCategory).reduce<Record<string, number>>((result, [key, value]) => {
    result[key] = Math.round(value * 100) / 100;
    return result;
  }, {});
}

export async function loadDashboardSnapshot(userId: string): Promise<DashboardSnapshot> {
  const [transactions, categories] = await Promise.all([
    loadCurrentMonthTransactions(userId),
    loadUserCategories(userId)
  ]);
  const topLevelCategories = categories.filter((category) => !category.parent_id);
  const topLevelIds = topLevelCategories.map((category) => category.id);
  const [budgets, spentByCategory] = await Promise.all([
    loadCurrentMonthBudgets({
      categoryIds: topLevelIds,
      userId
    }),
    loadCurrentMonthCategorySpendMap(userId)
  ]);

  const debitSpent = transactions.reduce((sum, transaction) => {
    if (transaction.direction && transaction.direction !== 'debit') {
      return sum;
    }

    return sum + toNumber(transaction.amount);
  }, 0);
  const totalBudget = budgets.reduce(
    (sum, budget) => sum + toNumber(budget.assigned_amount),
    0
  );
  const safeBudget = totalBudget > 0 ? totalBudget : budgetSummary.totalBudget;
  const left = Math.max(safeBudget - debitSpent, 0);
  const underAmount = Math.abs(safeBudget - debitSpent);
  const budgetByCategoryId = new Map(
    budgets.map((budget) => [budget.category_id, toNumber(budget.assigned_amount)])
  );
  const derivedCategoryCards = topLevelCategories
    .map((category) => {
      const budget = budgetByCategoryId.get(category.id) ?? 0;
      const spent = spentByCategory[normalizedCategory(category.name)] ?? 0;

      if (budget <= 0) {
        return null;
      }

      const remaining = budget - spent;

      return {
        amount: Math.round(Math.abs(remaining)),
        color: category.accent_color ?? '#4C76D6',
        icon: category.icon ?? 'pricetag-outline',
        name: category.name,
        status: remaining < 0 ? 'over' : 'left',
        usedRatio: Math.min(spent / budget, 1)
      };
    })
    .filter((card): card is NonNullable<typeof card> => Boolean(card))
    .sort((leftCard, rightCard) => rightCard.usedRatio - leftCard.usedRatio);

  return {
    budgetSummary: {
      left: Math.round(left * 100) / 100,
      totalBudget: Math.round(safeBudget * 100) / 100,
      underAmount: Math.round(underAmount * 100) / 100
    },
    categoryBudgets: derivedCategoryCards.length ? derivedCategoryCards : categoryBudgets
  };
}
