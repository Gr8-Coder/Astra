import { categoryBudgetItems, type CategoryBudgetItem } from '../data/categories';
import { supabase } from './supabase';

type DbCategoryRow = {
  accent_color: string | null;
  icon: string | null;
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
};

type DbBudgetRow = {
  assigned_amount: number | string;
  category_id: string;
  id: string;
};

type CategorySeedBlueprint = {
  accent: string;
  budget: number;
  icon: string;
  isGroup: boolean;
  name: string;
  parentGroupName: string | null;
  sortOrder: number;
};

type MonthRange = {
  end: string;
  start: string;
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

function currentMonthRange(now: Date = new Date()): MonthRange {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    end: end.toISOString().slice(0, 10),
    start: start.toISOString().slice(0, 10)
  };
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function slugify(value: string) {
  return normalizeName(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function seedBlueprints() {
  const blueprints: CategorySeedBlueprint[] = [];
  let activeGroup: string | null = null;

  categoryBudgetItems.forEach((item, index) => {
    const isGroup = Boolean(item.isGroup);
    const isChild = item.level === 1;

    if (isGroup) {
      activeGroup = item.name;
    } else if (!isChild) {
      activeGroup = null;
    }

    blueprints.push({
      accent: item.accent,
      budget: item.budget,
      icon: item.icon,
      isGroup,
      name: item.name,
      parentGroupName: isChild ? activeGroup : null,
      sortOrder: (index + 1) * 10
    });
  });

  return blueprints;
}

function itemTone(spent: number, budget: number): CategoryBudgetItem['tone'] {
  if (budget <= 0) {
    return 'green';
  }

  const ratio = spent / budget;

  if (ratio > 1) {
    return 'red';
  }

  if (ratio >= 0.85) {
    return 'orange';
  }

  if (ratio >= 0.65) {
    return 'yellow';
  }

  return 'green';
}

function mapCategoriesToBudgetItems({
  budgets,
  categories
}: {
  budgets: DbBudgetRow[];
  categories: DbCategoryRow[];
}): CategoryBudgetItem[] {
  const budgetByCategoryId = new Map<string, number>(
    budgets.map((budget) => [budget.category_id, toNumber(budget.assigned_amount)])
  );
  const childrenByParent = new Map<string, DbCategoryRow[]>();

  categories.forEach((category) => {
    if (!category.parent_id) {
      return;
    }

    const current = childrenByParent.get(category.parent_id) ?? [];
    childrenByParent.set(category.parent_id, [...current, category]);
  });

  const parents = categories
    .filter((category) => !category.parent_id)
    .sort((left, right) => left.sort_order - right.sort_order);
  const items: CategoryBudgetItem[] = [];

  parents.forEach((parent) => {
    const children = (childrenByParent.get(parent.id) ?? []).sort(
      (left, right) => left.sort_order - right.sort_order
    );
    const budget = budgetByCategoryId.get(parent.id) ?? 0;

    items.push({
      accent: parent.accent_color ?? '#4C76D6',
      budget,
      icon: parent.icon ?? 'pricetag-outline',
      isGroup: children.length > 0,
      name: parent.name,
      spent: 0,
      tone: itemTone(0, budget)
    });

    children.forEach((child) => {
      const childBudget = budgetByCategoryId.get(child.id) ?? 0;

      items.push({
        accent: child.accent_color ?? '#4C76D6',
        budget: childBudget,
        icon: child.icon ?? 'pricetag-outline',
        level: 1,
        name: child.name,
        spent: 0,
        tone: itemTone(0, childBudget)
      });
    });
  });

  return items;
}

async function fetchUserCategories(userId: string) {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, icon, accent_color, parent_id, sort_order')
    .eq('user_id', userId)
    .eq('is_system', false)
    .order('sort_order', { ascending: true });

  if (error) {
    throw error;
  }

  return (data as DbCategoryRow[] | null) ?? [];
}

async function fetchBudgetsForCurrentMonth({
  categoryIds,
  userId
}: {
  categoryIds: string[];
  userId: string;
}) {
  if (!categoryIds.length) {
    return [];
  }

  const range = currentMonthRange();

  const { data, error } = await supabase
    .from('budgets')
    .select('id, category_id, assigned_amount')
    .eq('user_id', userId)
    .eq('period_start', range.start)
    .eq('period_end', range.end)
    .in('category_id', categoryIds);

  if (error) {
    throw error;
  }

  return (data as DbBudgetRow[] | null) ?? [];
}

async function seedDefaultCategories(userId: string) {
  const blueprints = seedBlueprints();
  const topLevelBlueprints = blueprints.filter((item) => !item.parentGroupName);
  const topLevelRows = topLevelBlueprints.map((item) => ({
    accent_color: item.accent,
    icon: item.icon,
    is_system: false,
    kind: 'expense',
    name: item.name,
    parent_id: null,
    slug: slugify(item.name),
    sort_order: item.sortOrder,
    user_id: userId
  }));

  const { error: topInsertError } = await supabase
    .from('categories')
    .insert(topLevelRows);

  if (topInsertError) {
    throw topInsertError;
  }

  const insertedCategories = await fetchUserCategories(userId);
  const parentIdByName = new Map(
    insertedCategories
      .filter((category) => !category.parent_id)
      .map((category) => [normalizeName(category.name), category.id])
  );
  const childBlueprints = blueprints.filter((item) => item.parentGroupName);
  const childRows = childBlueprints
    .map((item) => {
      const parentId = parentIdByName.get(normalizeName(item.parentGroupName ?? ''));

      if (!parentId) {
        return null;
      }

      return {
        accent_color: item.accent,
        icon: item.icon,
        is_system: false,
        kind: 'expense',
        name: item.name,
        parent_id: parentId,
        slug: slugify(item.name),
        sort_order: item.sortOrder,
        user_id: userId
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (childRows.length) {
    const { error: childInsertError } = await supabase.from('categories').insert(childRows);

    if (childInsertError) {
      throw childInsertError;
    }
  }
}

async function seedDefaultBudgets({
  categories,
  userId
}: {
  categories: DbCategoryRow[];
  userId: string;
}) {
  if (!categories.length) {
    return;
  }

  const range = currentMonthRange();
  const existingBudgets = await fetchBudgetsForCurrentMonth({
    categoryIds: categories.map((category) => category.id),
    userId
  });

  if (existingBudgets.length) {
    return;
  }

  const seedBudgetByName = new Map(
    seedBlueprints().map((item) => [normalizeName(item.name), item.budget])
  );
  const budgetRows = categories.map((category) => ({
    assigned_amount: seedBudgetByName.get(normalizeName(category.name)) ?? 0,
    category_id: category.id,
    period_end: range.end,
    period_start: range.start,
    user_id: userId
  }));

  const { error } = await supabase
    .from('budgets')
    .upsert(budgetRows, { onConflict: 'user_id,category_id,period_start,period_end' });

  if (error) {
    throw error;
  }
}

export async function loadCategoryBudgetItems(userId: string): Promise<CategoryBudgetItem[]> {
  let categories = await fetchUserCategories(userId);

  if (!categories.length) {
    await seedDefaultCategories(userId);
    categories = await fetchUserCategories(userId);
  }

  await seedDefaultBudgets({
    categories,
    userId
  });

  const budgets = await fetchBudgetsForCurrentMonth({
    categoryIds: categories.map((category) => category.id),
    userId
  });
  const mapped = mapCategoriesToBudgetItems({
    budgets,
    categories
  });

  if (mapped.length) {
    return mapped;
  }

  return categoryBudgetItems;
}

export async function addCategoryWithBudget({
  accentColor,
  budget,
  icon,
  name,
  parentCategoryName,
  userId
}: {
  accentColor: string;
  budget: number;
  icon: string;
  name: string;
  parentCategoryName?: string;
  userId: string;
}) {
  const normalizedName = normalizeName(name);
  const allCategories = await fetchUserCategories(userId);
  const duplicate = allCategories.some((category) => normalizeName(category.name) === normalizedName);

  if (duplicate) {
    throw new Error('This category already exists.');
  }

  const parentId = parentCategoryName
    ? allCategories.find((category) => normalizeName(category.name) === normalizeName(parentCategoryName))?.id ?? null
    : null;
  const maxSortOrder = allCategories.reduce((max, category) => Math.max(max, category.sort_order), 0);

  const { data, error } = await supabase
    .from('categories')
    .insert({
      accent_color: accentColor,
      icon,
      is_system: false,
      kind: 'expense',
      name: name.trim(),
      parent_id: parentId,
      slug: slugify(name),
      sort_order: maxSortOrder + 10,
      user_id: userId
    })
    .select('id, name, icon, accent_color, parent_id, sort_order')
    .single();

  if (error) {
    throw error;
  }

  const range = currentMonthRange();
  const insertedCategory = data as DbCategoryRow;

  const { error: budgetError } = await supabase.from('budgets').upsert(
    {
      assigned_amount: Math.round(Math.max(budget, 0) * 100) / 100,
      category_id: insertedCategory.id,
      period_end: range.end,
      period_start: range.start,
      user_id: userId
    },
    { onConflict: 'user_id,category_id,period_start,period_end' }
  );

  if (budgetError) {
    throw budgetError;
  }

  return {
    accent: insertedCategory.accent_color ?? '#4C76D6',
    budget: Math.round(Math.max(budget, 0) * 100) / 100,
    icon: insertedCategory.icon ?? 'pricetag-outline',
    level: parentId ? (1 as const) : undefined,
    name: insertedCategory.name,
    spent: 0,
    tone: itemTone(0, budget)
  } satisfies CategoryBudgetItem;
}

export async function rebalanceCategoryBudget({
  budget,
  categoryName,
  userId
}: {
  budget: number;
  categoryName: string;
  userId: string;
}) {
  const categories = await fetchUserCategories(userId);
  const target = categories.find((category) => normalizeName(category.name) === normalizeName(categoryName));

  if (!target) {
    throw new Error('Category was not found.');
  }

  const nextBudget = Math.round(Math.max(budget, 0) * 100) / 100;
  const range = currentMonthRange();

  const { error } = await supabase.from('budgets').upsert(
    {
      assigned_amount: nextBudget,
      category_id: target.id,
      period_end: range.end,
      period_start: range.start,
      user_id: userId
    },
    { onConflict: 'user_id,category_id,period_start,period_end' }
  );

  if (error) {
    throw error;
  }

  return nextBudget;
}

export function monthRangeForQueries() {
  return currentMonthRange();
}
