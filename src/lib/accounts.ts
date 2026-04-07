import { type DepositoryAccount } from '../data/accounts';
import { type RangeKey, type TrendPoint } from '../data/investments';
import {
  deriveBankAccountSignalsFromSmsTransactions,
  scanBankSmsTransactions,
  type SmsBankAccountSignal
} from './androidSms';
import {
  getLinkedBankConnectionState,
  importStatementTransactionsFallback,
  isFunctionUnavailable,
  retryLinkedBankConnectionSync,
  syncLinkedBankAccounts,
  syncLinkedTransactions,
  type RetryConnectionScope,
  verifyBankByOtp
} from './bankLinking';
import { supabase } from './supabase';

export type IndianBankOption = {
  accentColor: string;
  code: string;
  name: string;
};

type DbAccountRow = {
  created_at: string;
  current_balance: number | string | null;
  id: string;
  last_synced_at: string | null;
  metadata: Record<string, unknown> | null;
  mask: string | null;
  name: string;
  provider: string | null;
  provider_account_id: string | null;
};

type DbTransactionTrendRow = {
  amount: number | string;
  booked_at: string;
  direction: 'credit' | 'debit' | 'transfer' | null;
};

type PreviewBankLinkInput = {
  bankName: string;
  mobileNumber: string;
};

type ConnectBankInput = {
  bankName: string;
  mobileNumber: string;
  otp: string;
  userId: string;
};

type AddManualBankInput = {
  accountMask?: string;
  bankName: string;
  currentBalance: number;
  userId: string;
};

type SyncSmsDetectedBanksInput = {
  daysBack?: number;
  limit?: number;
  userId: string;
};

export type SyncSmsDetectedBanksResult = {
  bankNames: string[];
  detectedBanks: number;
  matchedMessages: number;
  scannedMessages: number;
  updatedAccounts: number;
};

export type LinkedConnectionState = {
  displayName?: string | null;
  id: string;
  lastAttemptedAt?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  lastSuccessAt?: string | null;
  nextRetryAt?: string | null;
  provider: string;
  retryCount: number;
  state: string;
  status: string;
};

export type StatementImportDraft = {
  amount: number;
  bookedAt?: string;
  description?: string;
  direction?: 'credit' | 'debit';
  merchant: string;
  providerTransactionId?: string;
};

const mockedOtp = '123456';

const bankCardPalette = [
  '#C7191E',
  '#2E78C5',
  '#4E8D3E',
  '#6A87B8',
  '#8C5DD6',
  '#D48A1F',
  '#2A9A8C',
  '#6E4B3A'
];

export const indianBankOptions: IndianBankOption[] = [
  { accentColor: '#0A66C2', code: 'SBI', name: 'State Bank of India' },
  { accentColor: '#0D55A4', code: 'HDFC', name: 'HDFC Bank' },
  { accentColor: '#A3162A', code: 'ICICI', name: 'ICICI Bank' },
  { accentColor: '#0B63AC', code: 'AXIS', name: 'Axis Bank' },
  { accentColor: '#C0212B', code: 'KOTAK', name: 'Kotak Mahindra Bank' },
  { accentColor: '#0D4C8C', code: 'PNB', name: 'Punjab National Bank' },
  { accentColor: '#C7191E', code: 'CAN', name: 'Canara Bank' },
  { accentColor: '#1A4C99', code: 'BOB', name: 'Bank of Baroda' },
  { accentColor: '#175CA8', code: 'UNION', name: 'Union Bank of India' },
  { accentColor: '#194F9F', code: 'IND', name: 'Indian Bank' },
  { accentColor: '#0B4D97', code: 'BOI', name: 'Bank of India' },
  { accentColor: '#005A9C', code: 'IOB', name: 'Indian Overseas Bank' },
  { accentColor: '#007A53', code: 'IDBI', name: 'IDBI Bank' },
  { accentColor: '#0064B1', code: 'YES', name: 'Yes Bank' },
  { accentColor: '#B4183A', code: 'INDUS', name: 'IndusInd Bank' },
  { accentColor: '#2365C5', code: 'FED', name: 'Federal Bank' },
  { accentColor: '#1F5D9F', code: 'HSBC', name: 'HSBC Bank India' },
  { accentColor: '#035B8F', code: 'SCB', name: 'Standard Chartered' },
  { accentColor: '#C81F3D', code: 'AU', name: 'AU Small Finance Bank' },
  { accentColor: '#1E4C8F', code: 'PAYTM', name: 'Paytm Payments Bank' }
];

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

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function rangeStartForKey(range: RangeKey, now: Date) {
  const start = new Date(now);

  if (range === '1W') {
    start.setDate(start.getDate() - 7);
    return start;
  }

  if (range === '1M') {
    start.setDate(start.getDate() - 30);
    return start;
  }

  if (range === '3M') {
    start.setDate(start.getDate() - 90);
    return start;
  }

  if (range === 'YTD') {
    return new Date(start.getFullYear(), 0, 1, 0, 0, 0, 0);
  }

  start.setDate(start.getDate() - 365);
  return start;
}

function signedTransactionDelta(row: DbTransactionTrendRow) {
  const amount = Math.abs(toNumber(row.amount));

  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  if (row.direction === 'credit') {
    return amount;
  }

  if (row.direction === 'debit') {
    return -amount;
  }

  return 0;
}

function downsampleTrend<T>(items: T[], maxPoints: number) {
  if (items.length <= maxPoints || maxPoints < 2) {
    return items;
  }

  const step = (items.length - 1) / (maxPoints - 1);
  const sampled: T[] = [];
  let lastIndex = -1;

  for (let pointIndex = 0; pointIndex < maxPoints; pointIndex += 1) {
    const targetIndex = Math.round(pointIndex * step);

    if (targetIndex === lastIndex) {
      continue;
    }

    const item = items[targetIndex];

    if (item) {
      sampled.push(item);
      lastIndex = targetIndex;
    }
  }

  const lastItem = items[items.length - 1];

  if (lastItem && sampled[sampled.length - 1] !== lastItem) {
    sampled.push(lastItem);
  }

  return sampled;
}

function toTrendPoints(samples: Array<{ at: number; value: number }>, startMs: number, endMs: number) {
  if (!samples.length) {
    return [];
  }

  const sampled = downsampleTrend(samples, 40);
  const values = sampled.map((sample) => sample.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const span = maxValue - minValue;
  const safeSpan = span > 0.01 ? span : 1;
  const durationMs = Math.max(1, endMs - startMs);
  const chartWidth = 300;
  const chartTop = 18;
  const chartBottom = 96;
  const chartHeight = chartBottom - chartTop;

  const points = sampled.map((sample) => {
    const progress = Math.min(1, Math.max(0, (sample.at - startMs) / durationMs));
    const normalized = Math.min(1, Math.max(0, (sample.value - minValue) / safeSpan));
    return {
      x: Math.round(progress * chartWidth),
      y: roundMoney(chartBottom - normalized * chartHeight)
    };
  });

  if (points.length === 1) {
    return [
      points[0],
      {
        x: chartWidth,
        y: points[0].y
      }
    ];
  }

  return points;
}

function hashCode(input: string) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function pickCardColor(bankName: string) {
  const fromBankOption = indianBankOptions.find(
    (option) => option.name.toLowerCase() === bankName.trim().toLowerCase()
  )?.accentColor;

  if (fromBankOption) {
    return fromBankOption;
  }

  const index = hashCode(bankName) % bankCardPalette.length;
  return bankCardPalette[index] ?? bankCardPalette[0];
}

function providerAccountId(bankName: string, mobileNumber: string) {
  const normalizedBank = bankName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const mobileLast4 = mobileNumber.slice(-4);
  return `mock-${normalizedBank}-${mobileLast4}`;
}

function manualProviderAccountId(bankName: string) {
  const normalizedBank = bankName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const random = Math.random().toString(36).slice(2, 7);
  return `manual-${normalizedBank}-${Date.now().toString(36)}-${random}`;
}

function normalizeValue(value: string) {
  return value.trim().toLowerCase();
}

function accountMaskLabel(mask?: string | null) {
  if (!mask) {
    return null;
  }

  const digits = mask.replace(/\D/g, '');

  if (digits.length >= 4) {
    return `A/C ••••${digits.slice(-4)}`;
  }

  const cleaned = mask.trim();
  return cleaned ? `A/C ${cleaned}` : null;
}

function toFourDigitMask(mask?: string | null) {
  if (!mask) {
    return undefined;
  }

  const digits = mask.replace(/\D/g, '');

  if (digits.length >= 4) {
    return digits.slice(-4);
  }

  const cleaned = mask.replace(/[^xX*0-9]/g, '');
  return cleaned || undefined;
}

function formatAccountMask(mask?: string) {
  const fourDigitMask = toFourDigitMask(mask);

  if (!fourDigitMask) {
    return undefined;
  }

  return `**** ${fourDigitMask}`;
}

function predictedBalance(bankName: string, mobileNumber: string) {
  const base = 5000;
  const spread = 125000;
  const raw = hashCode(`${bankName}-${mobileNumber}`);
  const amount = base + (raw % spread);
  return Math.round(amount * 100) / 100;
}

function mapDbAccount(row: DbAccountRow): DepositoryAccount {
  const metadata = row.metadata ?? {};
  const color =
    typeof metadata.visual_color === 'string' && metadata.visual_color.trim()
      ? metadata.visual_color
      : pickCardColor(row.name);
  const maskFromMetadata =
    typeof metadata.account_mask === 'string' && metadata.account_mask.trim()
      ? metadata.account_mask
      : undefined;
  const maskLabel = accountMaskLabel(maskFromMetadata ?? row.mask);

  const label =
    typeof metadata.account_label === 'string' && metadata.account_label.trim()
      ? metadata.account_label
      : maskLabel ?? 'Banking';

  const changeLabel =
    typeof metadata.change_label === 'string' && metadata.change_label.trim()
      ? metadata.change_label
      : '0.00%';

  return {
    changeLabel,
    current: toNumber(row.current_balance),
    id: row.id,
    label,
    name: row.name,
    visualColor: color
  };
}

function mapSnapshotToDepository(snapshot: {
  changeLabel?: string;
  currentBalance: number;
  label?: string;
  name: string;
  visualColor?: string;
}): DepositoryAccount {
  return {
    changeLabel: snapshot.changeLabel ?? '0.00%',
    current: snapshot.currentBalance,
    label: snapshot.label?.trim() ? snapshot.label : 'Banking',
    name: snapshot.name,
    visualColor: snapshot.visualColor?.trim() ? snapshot.visualColor : pickCardColor(snapshot.name)
  };
}

export function previewBankLink({ bankName, mobileNumber }: PreviewBankLinkInput) {
  const cleanedMobile = mobileNumber.replace(/\D/g, '').slice(0, 10);

  if (!bankName.trim()) {
    return {
      isValid: false as const,
      message: 'Please select a bank first.'
    };
  }

  if (cleanedMobile.length !== 10) {
    return {
      isValid: false as const,
      message: 'Please enter a valid 10-digit mobile number.'
    };
  }

  const masked = `XXXXXX${cleanedMobile.slice(-4)}`;

  return {
    isValid: true as const,
    message: `${bankName} account detected for mobile ${masked}. Enter OTP to continue.`,
    maskedMobile: masked
  };
}

export function searchBanks(query: string) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return indianBankOptions;
  }

  return indianBankOptions.filter((bank) =>
    `${bank.name} ${bank.code}`.toLowerCase().includes(normalized)
  );
}

export async function loadDepositoryAccounts(userId: string) {
  const { data, error } = await supabase
    .from('accounts')
    .select('id, name, current_balance, metadata, created_at, last_synced_at, mask, provider, provider_account_id')
    .eq('user_id', userId)
    .eq('kind', 'bank')
    .order('last_synced_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  const rows = (data as DbAccountRow[] | null) ?? [];
  return rows.map(mapDbAccount);
}

export async function loadAccountAssetTrendPoints({
  currentAssets,
  range,
  userId
}: {
  currentAssets: number;
  range: RangeKey;
  userId: string;
}): Promise<TrendPoint[]> {
  const now = new Date();
  const startDate = rangeStartForKey(range, now);
  const startMs = startDate.getTime();
  const endMs = now.getTime();

  const { data, error } = await supabase
    .from('transactions')
    .select('amount, direction, booked_at')
    .eq('user_id', userId)
    .gte('booked_at', startDate.toISOString())
    .lte('booked_at', now.toISOString())
    .order('booked_at', { ascending: true })
    .limit(1600);

  if (error) {
    throw error;
  }

  const rows = (data as DbTransactionTrendRow[] | null) ?? [];
  const netChange = rows.reduce((sum, row) => sum + signedTransactionDelta(row), 0);
  const clampedCurrent = Math.max(0, roundMoney(currentAssets));
  let runningBalance = Math.max(0, roundMoney(clampedCurrent - netChange));
  const balanceSamples: Array<{ at: number; value: number }> = [
    {
      at: startMs,
      value: runningBalance
    }
  ];

  rows.forEach((row) => {
    const bookedAtMs = new Date(row.booked_at).getTime();

    if (!Number.isFinite(bookedAtMs)) {
      return;
    }

    const safeAt = Math.min(endMs, Math.max(startMs, bookedAtMs));
    runningBalance = Math.max(0, roundMoney(runningBalance + signedTransactionDelta(row)));
    balanceSamples.push({
      at: safeAt,
      value: runningBalance
    });
  });

  balanceSamples.push({
    at: endMs,
    value: clampedCurrent
  });

  return toTrendPoints(balanceSamples, startMs, endMs);
}

export async function deleteDepositoryAccount({
  accountId,
  userId
}: {
  accountId: string;
  userId: string;
}) {
  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('user_id', userId)
    .eq('id', accountId);

  if (error) {
    throw error;
  }
}

function metadataAccountMask(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) {
    return undefined;
  }

  const raw =
    typeof metadata.account_mask === 'string' && metadata.account_mask.trim()
      ? metadata.account_mask
      : undefined;

  return toFourDigitMask(raw);
}

function toSignalKey(bankName: string, accountMask?: string) {
  return `${normalizeValue(bankName)}::${normalizeValue(accountMask ?? '')}`;
}

function toTimestamp(value?: string | null) {
  if (!value) {
    return 0;
  }

  const epoch = new Date(value).getTime();
  return Number.isFinite(epoch) ? epoch : 0;
}

function isSmsAutoDetectedAccount(account: DbAccountRow) {
  if (account.provider === 'bank-sms') {
    return true;
  }

  const source = account.metadata?.source;
  return typeof source === 'string' && source === 'sms_auto_detect';
}

function accountSignalKeyFromRow(account: DbAccountRow) {
  const accountMask = metadataAccountMask(account.metadata) ?? toFourDigitMask(account.mask);
  return toSignalKey(account.name, accountMask ?? undefined);
}

function chooseCanonicalSmsAccount(accounts: DbAccountRow[]) {
  return accounts.slice().sort((left, right) => {
    const leftBalance = toNumber(left.current_balance);
    const rightBalance = toNumber(right.current_balance);

    if (rightBalance !== leftBalance) {
      return rightBalance - leftBalance;
    }

    const rightSyncTime = toTimestamp(right.last_synced_at);
    const leftSyncTime = toTimestamp(left.last_synced_at);

    if (rightSyncTime !== leftSyncTime) {
      return rightSyncTime - leftSyncTime;
    }

    return toTimestamp(right.created_at) - toTimestamp(left.created_at);
  })[0];
}

function selectExistingAccountForSignal(signal: SmsBankAccountSignal, accounts: DbAccountRow[]) {
  const targetKeyWithMask = toSignalKey(signal.bankName, signal.accountMask);
  const targetUnknownKey = toSignalKey(signal.bankName, undefined);

  const exactMatch = accounts.find((account) => {
    const accountMask = metadataAccountMask(account.metadata) ?? toFourDigitMask(account.mask);
    return toSignalKey(account.name, accountMask) === targetKeyWithMask;
  });

  if (exactMatch) {
    return exactMatch;
  }

  if (signal.accountMask) {
    return null;
  }

  return (
    accounts.find((account) => {
      const accountMask = metadataAccountMask(account.metadata) ?? toFourDigitMask(account.mask);
      return toSignalKey(account.name, accountMask) === targetUnknownKey;
    }) ?? null
  );
}

export async function syncSmsDetectedBankAccounts({
  daysBack = 150,
  limit = 600,
  userId
}: SyncSmsDetectedBanksInput): Promise<SyncSmsDetectedBanksResult> {
  const smsScan = await scanBankSmsTransactions({ daysBack, limit });
  const signals = deriveBankAccountSignalsFromSmsTransactions(smsScan.transactions);

  if (!signals.length) {
    return {
      bankNames: [],
      detectedBanks: 0,
      matchedMessages: smsScan.matchedCount,
      scannedMessages: smsScan.scannedCount,
      updatedAccounts: 0
    };
  }

  const existingQuery = await supabase
    .from('accounts')
    .select('id, name, current_balance, metadata, created_at, last_synced_at, mask, provider, provider_account_id')
    .eq('user_id', userId)
    .eq('kind', 'bank');

  if (existingQuery.error) {
    throw existingQuery.error;
  }

  const existingAccounts = (existingQuery.data as DbAccountRow[] | null) ?? [];
  const smsAccounts = existingAccounts.filter(isSmsAutoDetectedAccount);
  const groupedSmsAccounts = new Map<string, DbAccountRow[]>();

  smsAccounts.forEach((account) => {
    const key = accountSignalKeyFromRow(account);
    const current = groupedSmsAccounts.get(key) ?? [];
    groupedSmsAccounts.set(key, [...current, account]);
  });

  const duplicateSmsAccountIds: string[] = [];

  groupedSmsAccounts.forEach((accounts) => {
    if (accounts.length <= 1) {
      return;
    }

    const canonical = chooseCanonicalSmsAccount(accounts);
    accounts.forEach((account) => {
      if (account.id !== canonical.id) {
        duplicateSmsAccountIds.push(account.id);
      }
    });
  });

  if (duplicateSmsAccountIds.length) {
    const deleteDuplicates = await supabase
      .from('accounts')
      .delete()
      .eq('user_id', userId)
      .in('id', duplicateSmsAccountIds);

    if (deleteDuplicates.error) {
      throw deleteDuplicates.error;
    }
  }

  let activeAccounts = existingAccounts.filter((account) => !duplicateSmsAccountIds.includes(account.id));
  const signalKeys = new Set(signals.map((signal) => toSignalKey(signal.bankName, signal.accountMask)));
  const staleSmsAccountIds = activeAccounts
    .filter((account) => {
      if (!isSmsAutoDetectedAccount(account)) {
        return false;
      }

      const key = accountSignalKeyFromRow(account);
      if (signalKeys.has(key)) {
        return false;
      }

      const balance = toNumber(account.current_balance);
      return balance <= 0;
    })
    .map((account) => account.id);

  if (staleSmsAccountIds.length) {
    const deleteStale = await supabase
      .from('accounts')
      .delete()
      .eq('user_id', userId)
      .in('id', staleSmsAccountIds);

    if (deleteStale.error) {
      throw deleteStale.error;
    }

    activeAccounts = activeAccounts.filter((account) => !staleSmsAccountIds.includes(account.id));
  }

  const nowIso = new Date().toISOString();
  let updatedAccounts = 0;
  const insertRows: Array<Record<string, unknown>> = [];

  for (const signal of signals) {
    const existingAccount = selectExistingAccountForSignal(signal, activeAccounts);
    const fourDigitMask = toFourDigitMask(signal.accountMask);
    const formattedMask = fourDigitMask ? `**** ${fourDigitMask}` : undefined;
    const hasBalanceFromSms = signal.latestBalanceAfter !== undefined;
    const resolvedBalance = Math.round(Math.max(signal.latestBalanceAfter ?? 0, 0) * 100) / 100;

    if (existingAccount) {
      const existingMetadata = existingAccount.metadata ?? {};
      const existingAccountLabel =
        typeof existingMetadata.account_label === 'string' ? existingMetadata.account_label.trim() : '';
      const preferredMaskLabel = accountMaskLabel(formattedMask);
      const mergedMetadata: Record<string, unknown> = {
        ...existingMetadata,
        account_label: preferredMaskLabel
          ? preferredMaskLabel
          : existingAccountLabel || 'Banking',
        account_mask:
          typeof existingMetadata.account_mask === 'string' && existingMetadata.account_mask.trim()
            ? existingMetadata.account_mask
            : formattedMask ?? null,
        change_label:
          hasBalanceFromSms
            ? 'Latest SMS'
            : typeof existingMetadata.change_label === 'string' && existingMetadata.change_label.trim()
              ? existingMetadata.change_label
              : '0.00%',
        sms_bank_name: signal.bankName,
        sms_last_detected_at: signal.lastTransactionAt.toISOString(),
        sms_sender_samples: signal.senderSamples,
        sms_source: 'device_sms',
        sms_transaction_count: signal.transactionCount,
        sms_has_balance: hasBalanceFromSms,
        visual_color:
          typeof existingMetadata.visual_color === 'string' && existingMetadata.visual_color.trim()
            ? existingMetadata.visual_color
            : pickCardColor(signal.bankName)
      };

      const currentBalance =
        hasBalanceFromSms
          ? resolvedBalance
          : toNumber(existingAccount.current_balance);

      const updateQuery = await supabase
        .from('accounts')
        .update({
          available_balance: currentBalance,
          current_balance: currentBalance,
          last_synced_at: nowIso,
          mask: existingAccount.mask ?? fourDigitMask ?? null,
          metadata: mergedMetadata
        })
        .eq('id', existingAccount.id)
        .eq('user_id', userId);

      if (updateQuery.error) {
        throw updateQuery.error;
      }

      updatedAccounts += 1;
      continue;
    }

    if (!hasBalanceFromSms) {
      continue;
    }

    insertRows.push({
      available_balance: resolvedBalance,
      current_balance: resolvedBalance,
      currency_code: 'INR',
      is_manual: false,
      kind: 'bank',
      last_synced_at: nowIso,
      mask: fourDigitMask ?? null,
      metadata: {
        account_label: accountMaskLabel(formattedMask) ?? 'Latest SMS balance',
        account_mask: formattedMask ?? null,
        change_label: 'Latest SMS',
        connected_via: 'sms_auto_detect',
        sms_bank_name: signal.bankName,
        sms_has_balance: true,
        sms_last_detected_at: signal.lastTransactionAt.toISOString(),
        sms_sender_samples: signal.senderSamples,
        sms_source: 'device_sms',
        sms_transaction_count: signal.transactionCount,
        source: 'sms_auto_detect',
        visual_color: pickCardColor(signal.bankName)
      },
      name: signal.bankName,
      provider: 'bank-sms',
      provider_account_id: signal.providerAccountId,
      subtype: 'savings',
      user_id: userId
    });
    updatedAccounts += 1;
  }

  if (insertRows.length) {
    const upsertQuery = await supabase
      .from('accounts')
      .upsert(insertRows, { onConflict: 'user_id,provider,provider_account_id' });

    if (upsertQuery.error) {
      throw upsertQuery.error;
    }
  }

  const bankNames = Array.from(new Set(signals.map((signal) => signal.bankName))).sort((a, b) =>
    a.localeCompare(b)
  );

  return {
    bankNames,
    detectedBanks: bankNames.length,
    matchedMessages: smsScan.matchedCount,
    scannedMessages: smsScan.scannedCount,
    updatedAccounts
  };
}

export async function loadLinkedConnectionState(connectionId?: string): Promise<LinkedConnectionState | null> {
  try {
    const result = await getLinkedBankConnectionState({
      connectionId
    });
    return result.connection ?? null;
  } catch (error) {
    if (isFunctionUnavailable(error)) {
      return null;
    }

    throw error;
  }
}

export async function retryLinkedConnectionSync({
  connectionId,
  scope = 'all'
}: {
  connectionId: string;
  scope?: RetryConnectionScope;
}) {
  return retryLinkedBankConnectionSync({
    connectionId,
    scope
  });
}

export async function importStatementFallback({
  accountName,
  connectionId,
  entries,
  fileName,
  fileType
}: {
  accountName?: string;
  connectionId?: string;
  entries: StatementImportDraft[];
  fileName?: string;
  fileType?: string;
}) {
  return importStatementTransactionsFallback({
    accountName,
    connectionId,
    entries,
    fileName,
    fileType
  });
}

export async function addManualBankAccount({
  accountMask,
  bankName,
  currentBalance,
  userId
}: AddManualBankInput) {
  const name = bankName.trim();

  if (!name) {
    throw new Error('Please select a bank.');
  }

  if (!Number.isFinite(currentBalance) || currentBalance < 0) {
    throw new Error('Please enter a valid current balance.');
  }

  const roundedBalance = Math.round(currentBalance * 100) / 100;
  const cardColor = pickCardColor(name);
  const mask = formatAccountMask(accountMask);

  const { data, error } = await supabase
    .from('accounts')
    .insert({
      available_balance: roundedBalance,
      current_balance: roundedBalance,
      currency_code: 'INR',
      is_manual: true,
      kind: 'bank',
      metadata: {
        account_label: accountMaskLabel(mask) ?? 'Banking',
        account_mask: mask ?? null,
        change_label: 'Manual',
        connected_via: 'manual_balance_entry',
        source: 'manual_depository',
        visual_color: cardColor
      },
      name,
      provider: 'manual-bank',
      provider_account_id: manualProviderAccountId(name),
      subtype: 'savings',
      user_id: userId
    })
    .select('id, name, current_balance, metadata, created_at, last_synced_at, mask, provider, provider_account_id')
    .single();

  if (error) {
    throw error;
  }

  return mapDbAccount(data as DbAccountRow);
}

export async function connectBankAccount({
  bankName,
  mobileNumber,
  otp,
  userId
}: ConnectBankInput) {
  const cleanedMobile = mobileNumber.replace(/\D/g, '').slice(0, 10);
  const cleanOtp = otp.replace(/\D/g, '').slice(0, 6);
  const validation = previewBankLink({ bankName, mobileNumber: cleanedMobile });

  if (!validation.isValid) {
    throw new Error(validation.message);
  }

  try {
    const verified = await verifyBankByOtp({
      bankName,
      mobileNumber: cleanedMobile,
      otp: cleanOtp
    });

    const syncResults = await Promise.allSettled([
      syncLinkedBankAccounts({
        connectionId: verified.connectionId
      }),
      syncLinkedTransactions({
        connectionId: verified.connectionId
      })
    ]);

    const failedSync = syncResults.find((result) => result.status === 'rejected');

    if (failedSync?.status === 'rejected') {
      const syncError = failedSync.reason;
      console.warn('[accounts] bank sync failed after connect', syncError);

      try {
        await retryLinkedBankConnectionSync({
          connectionId: verified.connectionId,
          scope: 'all'
        });
      } catch (retryError) {
        console.warn('[accounts] retry sync failed after connect', retryError);
      }
    }

    return mapSnapshotToDepository(verified.account);
  } catch (error) {
    if (!isFunctionUnavailable(error)) {
      throw error;
    }
  }

  if (cleanOtp !== mockedOtp) {
    throw new Error('Invalid OTP. For this MVP flow, use 123456.');
  }

  const providerId = providerAccountId(bankName, cleanedMobile);

  const existingQuery = await supabase
    .from('accounts')
    .select('id, name, current_balance, metadata, created_at, last_synced_at, mask, provider, provider_account_id')
    .eq('user_id', userId)
    .eq('provider', 'mock-bank-link')
    .eq('provider_account_id', providerId)
    .limit(1)
    .maybeSingle();

  if (existingQuery.error) {
    throw existingQuery.error;
  }

  if (existingQuery.data) {
    return mapDbAccount(existingQuery.data as DbAccountRow);
  }

  const generatedBalance = predictedBalance(bankName, cleanedMobile);
  const cardColor = pickCardColor(bankName);
  const last4 = cleanedMobile.slice(-4);

  const { data, error } = await supabase
    .from('accounts')
    .insert({
      available_balance: generatedBalance,
      current_balance: generatedBalance,
      currency_code: 'INR',
      is_manual: false,
      kind: 'bank',
      metadata: {
        account_label: 'Banking',
        account_mask: `**** ${last4}`,
        change_label: '0.00%',
        connected_via: 'mobile_otp_mock',
        mobile_last4: last4,
        source: 'bank_linking_flow',
        visual_color: cardColor
      },
      name: bankName,
      provider: 'mock-bank-link',
      provider_account_id: providerId,
      subtype: 'savings',
      user_id: userId
    })
    .select('id, name, current_balance, metadata, created_at, last_synced_at, mask, provider, provider_account_id')
    .single();

  if (error) {
    throw error;
  }

  return mapDbAccount(data as DbAccountRow);
}
