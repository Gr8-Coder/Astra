import {
  transactionCategoryOptions,
  transactionGroups as seededTransactionGroups,
  type TransactionGroup,
  type TransactionItem
} from '../data/transactions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scanBankSmsTransactions, type SmsTransactionDraft } from './androidSms';
import { ingestTransactions } from './ledgerIngestion';
import { supabase } from './supabase';

type DbTransactionRow = {
  amount: number | string;
  booked_at: string;
  id: string;
  manual: boolean;
  merchant_name: string;
  metadata: Record<string, unknown> | null;
};

type CategoryVisual = {
  icon: string;
  label: string;
  pillColor: string;
};

type RecurringTransactionInput = {
  amount: number;
  bookedAt?: Date;
  categoryLabel?: string;
  merchant: string;
  recurringItemId: string;
};

type ExternalTransactionDirection = 'credit' | 'debit' | 'transfer';

type ExternalTransactionInput = {
  accountMask?: string;
  amount: number;
  balanceAfter?: number;
  bankName?: string;
  bookedAt: Date;
  direction: ExternalTransactionDirection;
  merchant: string;
  provider: string;
  providerTransactionId: string;
  rawBody?: string;
  sender?: string;
};

type LoadTransactionGroupsOptions = {
  seedIfEmpty?: boolean;
};

export type SmsSyncRunResult = {
  groups: TransactionGroup[];
  scannedCount: number;
  syncedCount: number;
  trackingStarted: boolean;
};

const recurringCategoryRules: Array<{ keywords: string[]; label: string }> = [
  {
    keywords: ['spotify', 'netflix', 'hotstar', 'disney', 'prime', 'audible', 'youtube', 'yt music'],
    label: 'Streaming'
  },
  {
    keywords: ['rent', 'landlord', 'lease'],
    label: 'Rent'
  },
  {
    keywords: ['uber', 'ola', 'rapido', 'taxi', 'metro', 'cab', 'commute', 'fuel', 'petrol'],
    label: 'Car & Transport'
  },
  {
    keywords: ['blinkit', 'zepto', 'instamart', 'grocer', 'supermarket'],
    label: 'Groceries'
  },
  {
    keywords: [
      'swiggy',
      'zomato',
      'tiffin',
      'meal',
      'food',
      'coconut',
      'coconut water',
      'juice',
      'smoothie',
      'snack',
      'breakfast',
      'lunch',
      'dinner'
    ],
    label: 'Food & Drink'
  },
  {
    keywords: ['restaurant', 'cafe', 'taco', 'burger', 'pizza', 'kfc'],
    label: 'Restaurant'
  },
  {
    keywords: ['coffee', 'chaayos', 'starbucks'],
    label: 'Coffee'
  },
  {
    keywords: ['shop', 'mall', 'store', 'marketplace'],
    label: 'Shops'
  },
  {
    keywords: ['clothing', 'apparel', 'fashion', 'h&m', 'zara'],
    label: 'Clothing'
  },
  {
    keywords: ['trip', 'flight', 'hotel', 'airbnb', 'vacation', 'holiday'],
    label: 'Travel & Vacation'
  },
  {
    keywords: ['movie', 'cinema', 'entertainment', 'prime video'],
    label: 'Entertainment'
  },
  {
    keywords: ['electricity', 'water bill', 'internet', 'broadband', 'gas'],
    label: 'Utilities'
  },
  {
    keywords: ['pharmacy', 'medical', 'doctor', 'health', 'hospital'],
    label: 'Healthcare'
  },
  {
    keywords: ['gym', 'fitness', 'workout'],
    label: 'Gym'
  }
];

const smsTrackingStartKeyPrefix = 'astra.sms.tracking.start';
const smsLastScanKeyPrefix = 'astra.sms.tracking.last-scan';
const smsScanOverlapMs = 90 * 1000;

function smsTrackingStartKey(userId: string) {
  return `${smsTrackingStartKeyPrefix}.${userId}`;
}

function smsLastScanKey(userId: string) {
  return `${smsLastScanKeyPrefix}.${userId}`;
}

async function readStoredEpochMs(key: string) {
  const raw = await AsyncStorage.getItem(key);

  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

async function writeStoredEpochMs(key: string, epochMs: number) {
  await AsyncStorage.setItem(key, String(Math.max(0, Math.floor(epochMs))));
}

async function ensureSmsTrackingStart(userId: string, forceNow = false) {
  const now = Date.now();
  const startKey = smsTrackingStartKey(userId);
  const lastScanKey = smsLastScanKey(userId);

  if (forceNow) {
    await Promise.all([writeStoredEpochMs(startKey, now), writeStoredEpochMs(lastScanKey, now)]);
    return {
      lastScanEpochMs: now,
      startEpochMs: now,
      trackingStartedNow: true
    };
  }

  const [storedStartEpochMs, storedLastScanEpochMs] = await Promise.all([
    readStoredEpochMs(startKey),
    readStoredEpochMs(lastScanKey)
  ]);

  if (!storedStartEpochMs) {
    await Promise.all([writeStoredEpochMs(startKey, now), writeStoredEpochMs(lastScanKey, now)]);
    return {
      lastScanEpochMs: now,
      startEpochMs: now,
      trackingStartedNow: true
    };
  }

  if (!storedLastScanEpochMs) {
    await writeStoredEpochMs(lastScanKey, storedStartEpochMs);
  }

  return {
    lastScanEpochMs: storedLastScanEpochMs ?? storedStartEpochMs,
    startEpochMs: storedStartEpochMs,
    trackingStartedNow: false
  };
}

const categoryByLabel = transactionCategoryOptions.reduce<Record<string, CategoryVisual>>((lookup, option) => {
  lookup[option.label.trim().toLowerCase()] = {
    icon: option.icon,
    label: option.label,
    pillColor: option.pillColor
  };

  return lookup;
}, {});

const recurringCategoryExactOverrides: Record<string, string> = {
  coconut: 'Food & Drink',
  'coconut water': 'Food & Drink',
  tiffin: 'Food & Drink'
};

function normalizeLabel(value: string) {
  return value.trim().toLowerCase();
}

function categoryVisuals(label: string) {
  const fallback = categoryByLabel.other ?? {
    icon: '✨',
    label: 'Other',
    pillColor: '#4C76D6'
  };

  return categoryByLabel[normalizeLabel(label)] ?? fallback;
}

export function inferCategoryLabel(merchant: string, explicitCategory?: string) {
  if (explicitCategory) {
    const matchedExplicit = categoryByLabel[normalizeLabel(explicitCategory)];

    if (matchedExplicit) {
      return matchedExplicit.label;
    }
  }

  const normalizedMerchant = normalizeLabel(merchant);
  const exactOverrideLabel = recurringCategoryExactOverrides[normalizedMerchant];

  if (exactOverrideLabel) {
    return exactOverrideLabel;
  }

  const containsOverrideLabel = Object.entries(recurringCategoryExactOverrides).find(([keyword]) =>
    normalizedMerchant.includes(keyword)
  )?.[1];

  if (containsOverrideLabel) {
    return containsOverrideLabel;
  }

  const matchedRule = recurringCategoryRules.find((rule) =>
    rule.keywords.some((keyword) => normalizedMerchant.includes(keyword))
  );

  return matchedRule?.label ?? 'Other';
}

function numericAmount(value: number | string) {
  const nextValue = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function groupLabel(date: Date, now: Date) {
  if (isSameDay(date, now)) {
    return {
      label: 'Today',
      tone: 'today' as const
    };
  }

  const weekday = date
    .toLocaleDateString('en-US', { weekday: 'short' })
    .toUpperCase();
  const month = date
    .toLocaleDateString('en-US', { month: 'long' })
    .toUpperCase();

  return {
    label: `${weekday}, ${month} ${date.getDate()}`,
    tone: 'muted' as const
  };
}

function amountLabelFromAmount(amount: number) {
  const hasDecimals = amount % 1 !== 0;

  if (!hasDecimals) {
    return undefined;
  }

  return `₹ ${amount.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  })}`;
}

function amountLabelFromAmountAndDirection(
  amount: number,
  direction: ExternalTransactionDirection
) {
  const hasDecimals = amount % 1 !== 0;
  const prefix = direction === 'credit' ? '+' : '';

  return `${prefix}₹ ${amount.toLocaleString('en-IN', {
    maximumFractionDigits: hasDecimals ? 2 : 0,
    minimumFractionDigits: hasDecimals ? 2 : 0
  })}`;
}

function visualsForDirectionAndCategory(
  direction: ExternalTransactionDirection,
  categoryLabel: string
) {
  if (direction === 'credit') {
    return {
      icon: '💰',
      label: 'Income',
      pillColor: '#2DC9B3'
    };
  }

  return categoryVisuals(categoryLabel);
}

function recurringPeriodKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

function randomToken(length = 8) {
  return Math.random().toString(36).slice(2, 2 + length);
}

function manualProviderTransactionId(item: TransactionItem) {
  return `manual-${Date.now()}-${randomToken(6)}-${normalizeLabel(item.merchant).replace(/[^a-z0-9]+/g, '-')}`;
}

function recurringProviderTransactionId(recurringItemId: string, recurringPeriod: string) {
  return `recurring-${recurringItemId}-${recurringPeriod}`;
}

function recurringMetadataFilter(recurringItemId: string, recurringPeriod: string) {
  return {
    recurring_item_id: recurringItemId,
    recurring_period: recurringPeriod,
    source: 'recurring'
  };
}

function toTransactionItem(row: DbTransactionRow): { bookedAt: Date; item: TransactionItem } {
  const metadata = row.metadata ?? {};
  const source = typeof metadata.source === 'string' ? metadata.source : '';
  let storedCategory = String(metadata.category_label ?? metadata.category ?? 'Other');

  if (source === 'recurring' && normalizeLabel(storedCategory) === 'other') {
    storedCategory = inferCategoryLabel(row.merchant_name);
  }

  const fallbackVisuals = categoryVisuals(storedCategory);
  const amount = numericAmount(row.amount);
  const amountLabel =
    typeof metadata.amount_label === 'string' && metadata.amount_label.trim()
      ? metadata.amount_label
      : amountLabelFromAmount(amount);
  const bookedAt = new Date(row.booked_at);

  return {
    bookedAt,
    item: {
      amount,
      amountLabel,
      bankName:
        typeof metadata.bank_name === 'string' && metadata.bank_name.trim()
          ? metadata.bank_name
          : undefined,
      category: storedCategory,
      categoryIcon:
        typeof metadata.category_icon === 'string' && metadata.category_icon.trim()
          ? metadata.category_icon
          : fallbackVisuals.icon,
      isManual: Boolean(row.manual),
      merchant: row.merchant_name,
      pillColor:
        typeof metadata.pill_color === 'string' && metadata.pill_color.trim()
          ? metadata.pill_color
          : fallbackVisuals.pillColor,
      recurringItemId:
        typeof metadata.recurring_item_id === 'string' && metadata.recurring_item_id.trim()
          ? metadata.recurring_item_id
          : undefined,
      subtitle:
        typeof metadata.bank_name === 'string' && metadata.bank_name.trim()
          ? `via ${metadata.bank_name}`
          : undefined,
      source: typeof metadata.source === 'string' ? metadata.source : undefined
    }
  };
}

function toGroupedTransactions(rows: DbTransactionRow[]) {
  const now = new Date();
  const groups = new Map<string, TransactionGroup>();
  const order: string[] = [];

  rows.forEach((row) => {
    const { bookedAt, item } = toTransactionItem(row);
    const keyInfo = groupLabel(bookedAt, now);

    if (!groups.has(keyInfo.label)) {
      groups.set(keyInfo.label, {
        label: keyInfo.label,
        tone: keyInfo.tone,
        transactions: []
      });
      order.push(keyInfo.label);
    }

    groups.get(keyInfo.label)?.transactions.push(item);
  });

  return order.map((key) => groups.get(key)!).filter((group) => group.transactions.length > 0);
}

function seededRowsForUser(userId: string) {
  const now = new Date();

  return seededTransactionGroups.flatMap((group, groupIndex) => {
    const dayOffset = group.tone === 'today' ? 0 : groupIndex;

    return group.transactions.map((item, itemIndex) => {
      const bookedAt = new Date(now);
      bookedAt.setDate(now.getDate() - dayOffset);
      bookedAt.setHours(13 - itemIndex, 14 + itemIndex * 6, 0, 0);

      return {
        amount: item.amount,
        booked_at: bookedAt.toISOString(),
        direction: 'debit',
        manual: false,
        merchant_name: item.merchant,
        metadata: {
          amount_label: item.amountLabel ?? null,
          category_icon: item.categoryIcon,
          category_label: item.category,
          pill_color: item.pillColor,
          seeded: true
        },
        user_id: userId
      };
    });
  });
}

export async function fetchStoredTransactionGroups(userId: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, merchant_name, amount, booked_at, manual, metadata')
    .eq('user_id', userId)
    .order('booked_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) {
    throw error;
  }

  return toGroupedTransactions((data as DbTransactionRow[] | null) ?? []);
}

export async function seedStoredTransactionsIfEmpty(userId: string) {
  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .contains('metadata', { seeded: true });

  if (error) {
    throw error;
  }

  if ((count ?? 0) > 0) {
    return;
  }

  const rows = seededRowsForUser(userId);

  const { error: insertError } = await supabase.from('transactions').insert(rows);

  if (insertError) {
    throw insertError;
  }
}

export async function loadTransactionGroups(userId: string, options: LoadTransactionGroupsOptions = {}) {
  if (options.seedIfEmpty) {
    await seedStoredTransactionsIfEmpty(userId);
  }

  return fetchStoredTransactionGroups(userId);
}

export async function clearTransactionsAndStartFreshSmsTracking(userId: string) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  await ensureSmsTrackingStart(userId, true);

  return fetchStoredTransactionGroups(userId);
}

export async function syncSmsTransactionsFromNow(userId: string): Promise<SmsSyncRunResult> {
  const tracking = await ensureSmsTrackingStart(userId);
  const now = Date.now();

  if (tracking.trackingStartedNow) {
    return {
      groups: await fetchStoredTransactionGroups(userId),
      scannedCount: 0,
      syncedCount: 0,
      trackingStarted: true
    };
  }

  const sinceEpochMs = Math.max(
    tracking.startEpochMs,
    tracking.lastScanEpochMs - smsScanOverlapMs
  );
  const scan = await scanBankSmsTransactions({
    limit: 700,
    sinceEpochMs
  });

  const groups = scan.transactions.length
    ? await upsertSmsTransactionsAndReloadGroups(userId, scan.transactions)
    : await fetchStoredTransactionGroups(userId);

  await writeStoredEpochMs(smsLastScanKey(userId), now);

  return {
    groups,
    scannedCount: scan.scannedCount,
    syncedCount: scan.transactions.length,
    trackingStarted: false
  };
}

export async function addTransactionAndReloadGroups(userId: string, item: TransactionItem) {
  await ingestTransactions({
    events: [
      {
        amount: item.amount,
        bookedAt: new Date(),
        direction: 'debit',
        manual: true,
        merchant: item.merchant,
        metadata: {
          amount_label: item.amountLabel ?? null,
          category_icon: item.categoryIcon,
          category_label: item.category,
          pill_color: item.pillColor,
          seeded: false,
          source: 'manual'
        },
        provider: 'astra-manual',
        providerTransactionId: manualProviderTransactionId(item),
        rawPayload: {
          item
        }
      }
    ],
    source: 'manual',
    userId
  });

  return fetchStoredTransactionGroups(userId);
}

export async function upsertExternalTransactionsAndReloadGroups(
  userId: string,
  items: ExternalTransactionInput[]
) {
  if (!items.length) {
    return fetchStoredTransactionGroups(userId);
  }

  const events = items
    .map((item) => {
      const merchant = item.merchant.trim();
      const providerTransactionId = item.providerTransactionId.trim();
      const roundedAmount = Math.round(Math.abs(item.amount) * 100) / 100;

      if (!merchant || !providerTransactionId || !Number.isFinite(roundedAmount) || roundedAmount <= 0) {
        return null;
      }

      const categoryLabel =
        item.direction === 'credit' ? 'Income' : inferCategoryLabel(item.merchant);
      const visuals = visualsForDirectionAndCategory(item.direction, categoryLabel);

      return {
        amount: roundedAmount,
        bookedAt: item.bookedAt,
        direction: item.direction,
        manual: false,
        merchant,
        metadata: {
          account_mask: item.accountMask ?? null,
          amount_label: amountLabelFromAmountAndDirection(roundedAmount, item.direction),
          balance_after: item.balanceAfter ?? null,
          bank_name: item.bankName ?? null,
          category_icon: visuals.icon,
          category_label: visuals.label,
          pill_color: visuals.pillColor,
          seeded: false,
          sms_sender: item.sender ?? null,
          source: 'sms',
          transaction_direction: item.direction,
          tx_raw_body: item.rawBody ?? null
        },
        provider: item.provider,
        providerTransactionId,
        rawPayload: {
          account_mask: item.accountMask ?? null,
          amount: roundedAmount,
          balance_after: item.balanceAfter ?? null,
          bank_name: item.bankName ?? null,
          booked_at: item.bookedAt.toISOString(),
          direction: item.direction,
          merchant,
          sender: item.sender ?? null,
          tx_raw_body: item.rawBody ?? null
        }
      };
    })
    .filter((event): event is NonNullable<typeof event> => Boolean(event));

  if (!events.length) {
    return fetchStoredTransactionGroups(userId);
  }

  await ingestTransactions({
    events,
    source: 'connector',
    userId
  });

  return fetchStoredTransactionGroups(userId);
}

export async function upsertSmsTransactionsAndReloadGroups(
  userId: string,
  items: SmsTransactionDraft[]
) {
  const normalizedItems: ExternalTransactionInput[] = items.map((item) => ({
    accountMask: item.accountMask,
    amount: item.amount,
    balanceAfter: item.balanceAfter,
    bankName: item.bankName,
    bookedAt: item.bookedAt,
    direction: item.direction,
    merchant: item.merchant,
    provider: 'bank-sms',
    providerTransactionId: item.providerTransactionId,
    rawBody: item.rawBody,
    sender: item.sender
  }));

  return upsertExternalTransactionsAndReloadGroups(userId, normalizedItems);
}

export async function upsertRecurringPaymentAndReloadGroups(
  userId: string,
  input: RecurringTransactionInput
) {
  const roundedAmount = Math.round(input.amount * 100) / 100;

  if (!Number.isFinite(roundedAmount) || roundedAmount <= 0) {
    throw new Error('Recurring payment amount must be greater than 0.');
  }

  const bookedAt = input.bookedAt ?? new Date();
  const recurringPeriod = recurringPeriodKey(bookedAt);
  const categoryLabel = inferCategoryLabel(input.merchant, input.categoryLabel);
  const visuals = categoryVisuals(categoryLabel);
  const metadata = {
    ...recurringMetadataFilter(input.recurringItemId, recurringPeriod),
    amount_label: amountLabelFromAmount(roundedAmount) ?? null,
    category_icon: visuals.icon,
    category_label: visuals.label,
    pill_color: visuals.pillColor,
    seeded: false
  };
  await ingestTransactions({
    events: [
      {
        amount: roundedAmount,
        bookedAt,
        direction: 'debit',
        manual: false,
        merchant: input.merchant,
        metadata,
        provider: 'astra-recurring',
        providerTransactionId: recurringProviderTransactionId(input.recurringItemId, recurringPeriod),
        rawPayload: {
          amount: roundedAmount,
          booked_at: bookedAt.toISOString(),
          category_label: categoryLabel,
          merchant: input.merchant,
          recurring_item_id: input.recurringItemId,
          recurring_period: recurringPeriod
        }
      }
    ],
    source: 'recurring',
    userId
  });

  return fetchStoredTransactionGroups(userId);
}

export async function removeRecurringPaymentAndReloadGroups(
  userId: string,
  recurringItemId: string,
  bookedAt: Date = new Date()
) {
  const recurringPeriod = recurringPeriodKey(bookedAt);
  const recurringProviderTransactionKey = recurringProviderTransactionId(recurringItemId, recurringPeriod);

  const { error: providerDeleteError } = await supabase
    .from('transactions')
    .delete()
    .eq('user_id', userId)
    .eq('provider', 'astra-recurring')
    .eq('provider_transaction_id', recurringProviderTransactionKey);

  if (providerDeleteError) {
    throw providerDeleteError;
  }

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('user_id', userId)
    .contains('metadata', recurringMetadataFilter(recurringItemId, recurringPeriod));

  if (error) {
    throw error;
  }

  return fetchStoredTransactionGroups(userId);
}
