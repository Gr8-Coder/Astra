import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

type NativeSmsRow = {
  address?: string | null;
  body?: string | null;
  date?: number;
  id?: string | number | null;
};

type SmsDirection = 'credit' | 'debit';

export type SmsTransactionDraft = {
  accountMask?: string;
  amount: number;
  aiCategoryLabel?: string;
  aiConfidence?: number;
  aiEngine?: string;
  aiIsRecurring?: boolean;
  aiModelVersion?: string;
  aiPromptVersion?: string;
  aiReason?: string;
  aiUsedFallback?: boolean;
  balanceAfter?: number;
  bankName?: string;
  bookedAt: Date;
  direction: SmsDirection;
  merchant: string;
  providerTransactionId: string;
  rawBody: string;
  sender: string;
};

export type SmsBankAccountSignal = {
  accountMask?: string;
  bankName: string;
  latestBalanceAfter?: number;
  lastTransactionAt: Date;
  providerAccountId: string;
  senderSamples: string[];
  transactionCount: number;
};

export type SmsScanResult = {
  matchedCount: number;
  scannedCount: number;
  transactions: SmsTransactionDraft[];
};

type AstraSmsNativeModule = {
  listMessages: (limit: number, sinceEpochMs: number) => Promise<NativeSmsRow[]>;
};

const senderBankHints = [
  'SBI',
  'SBIYONO',
  'SBIINB',
  'SBIUPI',
  'HDFC',
  'HDFCBK',
  'ICICI',
  'ICICIB',
  'CANARA',
  'CANBNK',
  'CNRB',
  'HSBC',
  'BANDHAN',
  'BANDHN',
  'AXIS',
  'PNB',
  'KOTAK',
  'BOI',
  'UNION',
  'IDFC',
  'YESBNK',
  'INDUSB',
  'SCBANK',
  'SCISMS',
  'PAYTM'
];

const bodyTransactionHints =
  /(debited|credited|spent|received|sent|paid|withdrawn|purchase|salary|upi|imps|neft|rtgs|txn|transaction|a\/c|acct|balance|avl)/i;

const amountRegex = /(?:inr|rs\.?|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi;
const bankNamePatterns: Array<{ label: string; pattern: RegExp }> = [
  { label: 'ICICI Bank', pattern: /\bicici\b/i },
  { label: 'HDFC Bank', pattern: /\bhdfc\b/i },
  { label: 'State Bank of India', pattern: /\b(?:sbi|state bank of india)\b/i },
  { label: 'Canara Bank', pattern: /\b(?:canara|canbnk|cnrb)\b/i },
  { label: 'HSBC Bank', pattern: /\bhsbc\b/i },
  { label: 'Axis Bank', pattern: /\baxis\b/i },
  { label: 'Kotak Mahindra Bank', pattern: /\bkotak\b/i },
  { label: 'Punjab National Bank', pattern: /\b(?:pnb|punjab national)\b/i },
  { label: 'YES Bank', pattern: /\b(?:yesbnk|yes bank)\b/i },
  { label: 'IDFC FIRST Bank', pattern: /\b(?:idfc)\b/i },
  { label: 'Union Bank of India', pattern: /\bunion\b/i },
  { label: 'Bank of India', pattern: /\bboi\b/i },
  { label: 'IndusInd Bank', pattern: /\bindus(?:ind|b)\b/i },
  { label: 'Bandhan Bank', pattern: /\b(?:bandhan|bandhn)\b/i },
  { label: 'Paytm Payments Bank', pattern: /\bpaytm\b/i }
];

function smsModule() {
  return (NativeModules.AstraSmsModule as AstraSmsNativeModule | undefined) ?? null;
}

function toNumber(value: string) {
  const parsed = Number.parseFloat(value.replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseAmount(body: string, direction: SmsDirection) {
  const directionalRegex =
    direction === 'credit'
      ? /(?:credited|received|salary|deposited|cr(?:\.|\b))[^₹0-9]{0,40}(?:inr|rs\.?|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i
      : /(?:debited|spent|sent|paid|withdrawn|purchase|dr(?:\.|\b)|upi)[^₹0-9]{0,40}(?:inr|rs\.?|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i;

  const directionalMatch = body.match(directionalRegex)?.[1];

  if (directionalMatch) {
    const amount = toNumber(directionalMatch);

    if (amount > 0) {
      return amount;
    }
  }

  const matches = [...body.matchAll(amountRegex)];

  for (const match of matches) {
    const amount = toNumber(match[1] ?? '');

    if (amount > 0) {
      return amount;
    }
  }

  return 0;
}

function parseBalance(body: string) {
  const balanceMatch = body.match(
    /(?:avl(?:\.| )?bal(?:ance)?|available balance|total bal(?:ance)?|bal(?:ance)?)\D{0,18}(?:inr|rs\.?|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i
  )?.[1];

  return balanceMatch ? toNumber(balanceMatch) : undefined;
}

function parseAccountMask(body: string) {
  const patterns = [
    /(?:a\/c|acct|account)\s*(?:no\.?|number|ending|end|x+|xx+|xxxx|\*)?\s*([xX*0-9-]{2,})/i,
    /(?:ending|ends|last)\s*(?:with)?\s*([0-9]{2,})/i,
    /(?:xx+|\*+)\s*([0-9]{2,})/i
  ];

  for (const pattern of patterns) {
    const accountMatch = body.match(pattern)?.[1];

    if (!accountMatch) {
      continue;
    }

    const cleaned = accountMatch.replace(/[^xX*0-9]/g, '');

    if (!cleaned) {
      continue;
    }

    const digits = cleaned.replace(/\D/g, '');

    if (digits.length >= 4) {
      return digits.slice(-4);
    }

    if (digits.length >= 2) {
      return digits;
    }

    return cleaned.slice(-4);
  }

  return undefined;
}

export function resolveBankNameFromSender(sender: string) {
  const upper = sender.toUpperCase();

  if (upper.includes('ICICI')) {
    return 'ICICI Bank';
  }

  if (upper.includes('HSBC')) {
    return 'HSBC Bank';
  }

  if (upper.includes('CANARA') || upper.includes('CANBNK') || upper.includes('CNRB')) {
    return 'Canara Bank';
  }

  if (upper.includes('BANDHAN') || upper.includes('BANDHN')) {
    return 'Bandhan Bank';
  }

  if (upper.includes('HDFC')) {
    return 'HDFC Bank';
  }

  if (upper.includes('SBI')) {
    return 'State Bank of India';
  }

  if (upper.includes('AXIS')) {
    return 'Axis Bank';
  }

  if (upper.includes('KOTAK')) {
    return 'Kotak Mahindra Bank';
  }

  if (upper.includes('PNB')) {
    return 'Punjab National Bank';
  }

  if (upper.includes('YESBNK') || upper.includes('YESBK')) {
    return 'YES Bank';
  }

  if (upper.includes('IDFC')) {
    return 'IDFC FIRST Bank';
  }

  if (upper.includes('UNION')) {
    return 'Union Bank of India';
  }

  if (upper.includes('BOI')) {
    return 'Bank of India';
  }

  if (upper.includes('INDUSB')) {
    return 'IndusInd Bank';
  }

  if (upper.includes('PAYTM')) {
    return 'Paytm Payments Bank';
  }

  return null;
}

function resolveBankNameFromBody(body: string) {
  for (const entry of bankNamePatterns) {
    if (entry.pattern.test(body)) {
      return entry.label;
    }
  }

  return null;
}

function cleanupMerchant(raw: string) {
  return raw
    .replace(/\b(ref|utr|txn|txnid|trxn|ifsc)\b.*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseMerchant(body: string, sender: string, direction: SmsDirection, bankName?: string) {
  const upiRegex =
    direction === 'credit'
      ? /(?:from)\s+([a-z0-9@._& -]{3,50})(?:\s+on|\s+via|\s+ref|\s+utr|,|\.|$)/i
      : /(?:to)\s+([a-z0-9@._& -]{3,50})(?:\s+on|\s+via|\s+ref|\s+utr|,|\.|$)/i;
  const upiMatch = body.match(upiRegex)?.[1];

  if (upiMatch) {
    const merchant = cleanupMerchant(upiMatch);

    if (merchant.length >= 2) {
      return merchant;
    }
  }

  const atMatch = body.match(
    /\bat\s+([a-z0-9@._& -]{3,50})(?:\s+on|\s+via|\s+ref|\s+utr|,|\.|$)/i
  )?.[1];

  if (atMatch) {
    const merchant = cleanupMerchant(atMatch);

    if (merchant.length >= 2) {
      return merchant;
    }
  }

  const vpaMatch = body.match(/(?:vpa|upi id)\s*[:\-]?\s*([a-z0-9._-]{2,}@[a-z]{2,})/i)?.[1];

  if (vpaMatch) {
    const merchant = cleanupMerchant(vpaMatch);

    if (merchant.length >= 2) {
      return merchant;
    }
  }

  return bankName ?? 'Bank transaction';
}

function resolveDirection(body: string): SmsDirection | null {
  const hasDebit = /(debited|debit|spent|sent|paid|withdrawn|withdrawal|purchase|dr(?:\.|\b)|upi payment)/i.test(body);
  const hasCredit = /(credited|credit|received|salary|refund|deposited|cr(?:\.|\b)|reversal)/i.test(body);

  if (hasDebit && !hasCredit) {
    return 'debit';
  }

  if (hasCredit && !hasDebit) {
    return 'credit';
  }

  if (hasCredit) {
    return 'credit';
  }

  if (hasDebit) {
    return 'debit';
  }

  return null;
}

function looksLikeBankMessage(sender: string, body: string) {
  if (!bodyTransactionHints.test(body)) {
    return false;
  }

  const combined = `${sender} ${body}`.toUpperCase();
  return senderBankHints.some((hint) => combined.includes(hint));
}

function parseMessage(row: NativeSmsRow): SmsTransactionDraft | null {
  const body = (row.body ?? '').replace(/\s+/g, ' ').trim();
  const sender = (row.address ?? '').trim();

  if (!body || !sender || !looksLikeBankMessage(sender, body)) {
    return null;
  }

  const direction = resolveDirection(body);

  if (!direction) {
    return null;
  }

  const amount = parseAmount(body, direction);

  if (!amount) {
    return null;
  }

  const messageId = String(row.id ?? '').trim();

  if (!messageId) {
    return null;
  }

  const time = Number.isFinite(row.date) ? Number(row.date) : Date.now();
  const bankName =
    resolveBankNameFromSender(sender) ?? resolveBankNameFromBody(body) ?? undefined;

  return {
    accountMask: parseAccountMask(body),
    amount,
    balanceAfter: parseBalance(body),
    bankName,
    bookedAt: new Date(time),
    direction,
    merchant: parseMerchant(body, sender, direction, bankName),
    providerTransactionId: `sms-${messageId}`,
    rawBody: body,
    sender
  };
}

function normalizeForSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function providerAccountIdFromSmsSignal(bankName: string, accountMask?: string) {
  const bankSlug = normalizeForSlug(bankName) || 'bank';

  if (accountMask) {
    return `sms-${bankSlug}-${accountMask}`;
  }

  return `sms-${bankSlug}-unknown`;
}

export function deriveBankAccountSignalsFromSmsTransactions(
  transactions: SmsTransactionDraft[]
): SmsBankAccountSignal[] {
  const ordered = transactions
    .slice()
    .sort((a, b) => b.bookedAt.getTime() - a.bookedAt.getTime());
  const grouped = new Map<string, SmsBankAccountSignal>();

  ordered.forEach((transaction) => {
    const bankName = transaction.bankName?.trim();

    if (!bankName) {
      return;
    }

    const accountMask = transaction.accountMask?.trim() || undefined;
    const key = `${bankName.toLowerCase()}::${accountMask ?? 'unknown'}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.transactionCount += 1;

      if (!existing.senderSamples.includes(transaction.sender)) {
        existing.senderSamples.push(transaction.sender);
      }

      if (
        existing.latestBalanceAfter === undefined &&
        typeof transaction.balanceAfter === 'number' &&
        Number.isFinite(transaction.balanceAfter) &&
        transaction.balanceAfter >= 0
      ) {
        existing.latestBalanceAfter = transaction.balanceAfter;
      }

      return;
    }

    grouped.set(key, {
      accountMask,
      bankName,
      latestBalanceAfter:
        typeof transaction.balanceAfter === 'number' &&
        Number.isFinite(transaction.balanceAfter) &&
        transaction.balanceAfter >= 0
          ? transaction.balanceAfter
          : undefined,
      lastTransactionAt: transaction.bookedAt,
      providerAccountId: providerAccountIdFromSmsSignal(bankName, accountMask),
      senderSamples: [transaction.sender],
      transactionCount: 1
    });
  });

  return Array.from(grouped.values());
}

async function ensureSmsPermission() {
  if (Platform.OS !== 'android') {
    throw new Error('SMS sync is currently available only on Android.');
  }

  const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);

  if (granted) {
    return;
  }

  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS, {
    buttonNegative: 'Not now',
    buttonPositive: 'Allow',
    message:
      'Astra needs SMS access to read official bank debit and credit alerts for auto transaction sync.',
    title: 'Allow SMS access'
  });

  if (result !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error('SMS permission was not granted.');
  }
}

export async function scanBankSmsTransactions({
  daysBack = 120,
  limit = 500,
  sinceEpochMs
}: {
  daysBack?: number;
  limit?: number;
  sinceEpochMs?: number;
} = {}): Promise<SmsScanResult> {
  if (Platform.OS !== 'android') {
    throw new Error('SMS sync is currently available only on Android.');
  }

  const nativeModule = smsModule();

  if (!nativeModule?.listMessages) {
    throw new Error(
      'SMS module is not available. Install/open the Android development build of Astra (not Expo Go).'
    );
  }

  await ensureSmsPermission();

  const fallbackSinceEpochMs = Date.now() - Math.max(daysBack, 1) * 24 * 60 * 60 * 1000;
  const effectiveSinceEpochMs =
    typeof sinceEpochMs === 'number' && Number.isFinite(sinceEpochMs)
      ? Math.max(0, Math.floor(sinceEpochMs))
      : fallbackSinceEpochMs;
  const rows = await nativeModule.listMessages(Math.max(limit, 30), effectiveSinceEpochMs);
  const parsed = rows.map(parseMessage).filter((item): item is SmsTransactionDraft => Boolean(item));
  const uniqueTransactions = new Map<string, SmsTransactionDraft>();

  parsed.forEach((item) => {
    uniqueTransactions.set(item.providerTransactionId, item);
  });

  return {
    matchedCount: parsed.length,
    scannedCount: rows.length,
    transactions: Array.from(uniqueTransactions.values())
  };
}

export function isSmsSyncUnavailableError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes('sms permission was not granted') ||
    message.includes('sms module is not available') ||
    message.includes('sms sync is currently available only on android')
  );
}
