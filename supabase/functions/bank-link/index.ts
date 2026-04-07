import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json'
};

type JsonRecord = Record<string, unknown>;

type AuthContext = {
  db: SupabaseClient;
  provider: string;
  userId: string;
};

type ConnectorLinkState =
  | 'idle'
  | 'session_created'
  | 'awaiting_user'
  | 'token_exchanged'
  | 'syncing_accounts'
  | 'syncing_transactions'
  | 'connected'
  | 'retry_scheduled'
  | 'error';

type DbErrorLike = {
  code?: string;
  message?: string;
};

type ConnectionStateRow = {
  display_name: string | null;
  external_connection_id: string | null;
  id: string;
  institution_id: string | null;
  last_attempted_at?: string | null;
  last_error_code?: string | null;
  last_error_message?: string | null;
  last_success_at?: string | null;
  link_state?: ConnectorLinkState | null;
  next_retry_at?: string | null;
  provider: string | null;
  retry_count?: number | null;
  status?: string | null;
};

type ProviderRequestOptions = {
  attemptTimeoutMs?: number;
  headers?: Record<string, string>;
  maxAttempts?: number;
  pathLabel: string;
};

class ProviderRequestError extends Error {
  code?: string;
  retryable: boolean;
  statusCode?: number;

  constructor(message: string, options?: { code?: string; retryable?: boolean; statusCode?: number }) {
    super(message);
    this.name = 'ProviderRequestError';
    this.code = options?.code;
    this.retryable = options?.retryable ?? false;
    this.statusCode = options?.statusCode;
  }
}

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

function response(status: number, payload: JsonRecord) {
  return new Response(JSON.stringify(payload), {
    headers: corsHeaders,
    status
  });
}

function success<T extends JsonRecord>(data: T) {
  return response(200, {
    data,
    success: true
  });
}

function failure(statusCode: number, message: string, extra: JsonRecord = {}) {
  return response(statusCode, {
    error: message,
    ...extra,
    statusCode,
    success: false
  });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }

  return value;
}

function optionalString(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const next = value.trim();
  return next ? next : null;
}

function digitsOnly(value: unknown, maxLength: number) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\D/g, '').slice(0, maxLength);
}

function hashCode(input: string) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function normalizeSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function predictedBalance(seed: string) {
  const raw = hashCode(seed);
  const amount = 5000 + (raw % 125000);
  return Math.round(amount * 100) / 100;
}

function visualColor(bankName: string) {
  const index = hashCode(bankName) % bankCardPalette.length;
  return bankCardPalette[index] ?? bankCardPalette[0];
}

function inferCategoryLabel(value: string) {
  const normalized = value.toLowerCase();

  const rules: Array<{ keywords: string[]; label: string }> = [
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
      keywords: ['swiggy', 'zomato', 'tiffin', 'meal', 'food', 'coconut', 'juice', 'smoothie', 'snack'],
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

  const matched = rules.find((rule) =>
    rule.keywords.some((keyword) => normalized.includes(keyword))
  );

  return matched?.label ?? 'Other';
}

function isMissingTableError(error: unknown) {
  const typed = error as DbErrorLike;
  return typed?.code === '42P01';
}

function asDbError(error: unknown) {
  if (typeof error === 'object' && error !== null) {
    return error as DbErrorLike;
  }

  return {};
}

function isMissingColumnError(error: unknown) {
  const typed = error as DbErrorLike;
  return typed?.code === '42703';
}

function parsedInteger(value: string | undefined, fallback: number, min = 1, max = 10) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function retryableHttpStatus(status: number) {
  return [408, 409, 425, 429, 500, 502, 503, 504].includes(status);
}

function retryDelayMs(attempt: number) {
  const base = 450;
  const maxBackoff = 4000;
  const exponential = Math.min(maxBackoff, base * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.round(Math.random() * 180);
  return exponential + jitter;
}

function nextRetryAtIso(retryCount: number) {
  const scheduleMinutes = [1, 3, 10, 30, 120];
  const index = Math.min(scheduleMinutes.length - 1, Math.max(0, retryCount - 1));
  const minutes = scheduleMinutes[index] ?? 120;
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

async function providerRequest<T extends JsonRecord>(
  url: string,
  payload: JsonRecord,
  options: ProviderRequestOptions
) {
  const maxAttempts = options.maxAttempts ?? parsedInteger(Deno.env.get('BANK_LINK_MAX_ATTEMPTS'), 3, 1, 6);
  const timeoutMs = options.attemptTimeoutMs ?? parsedInteger(Deno.env.get('BANK_LINK_TIMEOUT_MS'), 9000, 2000, 30000);
  let lastError: ProviderRequestError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers ?? {})
        },
        method: 'POST',
        signal: controller.signal
      });

      if (!response.ok) {
        const retryable = retryableHttpStatus(response.status);
        const message = `${options.pathLabel} failed (${response.status}).`;
        const error = new ProviderRequestError(message, {
          code: `http_${response.status}`,
          retryable,
          statusCode: response.status
        });

        if (!retryable || attempt >= maxAttempts) {
          throw error;
        }

        lastError = error;
      } else {
        const data = (await response.json()) as T;
        return data;
      }
    } catch (error) {
      const normalized =
        error instanceof ProviderRequestError
          ? error
          : new ProviderRequestError(
              `${options.pathLabel} network failure.`,
              {
                code: 'network_error',
                retryable: true
              }
            );

      if (!normalized.retryable || attempt >= maxAttempts) {
        throw normalized;
      }

      lastError = normalized;
    } finally {
      clearTimeout(timeout);
    }

    await sleep(retryDelayMs(attempt));
  }

  throw (
    lastError ??
    new ProviderRequestError(`${options.pathLabel} failed unexpectedly.`, {
      code: 'unknown_provider_error',
      retryable: false
    })
  );
}

async function authContext(req: Request): Promise<AuthContext> {
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const supabaseAnonKey = requiredEnv('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();

  const authorization = req.headers.get('Authorization') ?? '';

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false
    },
    global: {
      headers: {
        Authorization: authorization
      }
    }
  });

  const { data, error } = await userClient.auth.getUser();

  if (error || !data.user) {
    throw new Error('Unauthorized');
  }

  const db = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          persistSession: false
        }
      })
    : userClient;

  return {
    db,
    provider: Deno.env.get('BANK_LINK_PROVIDER')?.trim() || 'mock',
    userId: data.user.id
  };
}

async function ensureInstitutionId({
  db,
  institutionName,
  provider,
  providerInstitutionId,
  userId
}: {
  db: SupabaseClient;
  institutionName: string;
  provider: string;
  providerInstitutionId: string;
  userId: string;
}) {
  const existing = await db
    .from('institutions')
    .select('id')
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('provider_institution_id', providerInstitutionId)
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  if (existing.data?.id) {
    return existing.data.id as string;
  }

  const inserted = await db
    .from('institutions')
    .insert({
      metadata: {
        source: 'bank-link'
      },
      name: institutionName,
      provider,
      provider_institution_id: providerInstitutionId,
      status: 'active',
      user_id: userId
    })
    .select('id')
    .single();

  if (inserted.error) {
    throw inserted.error;
  }

  return inserted.data.id as string;
}

async function ensureConnectionId({
  db,
  displayName,
  externalConnectionId,
  institutionId,
  provider,
  userId
}: {
  db: SupabaseClient;
  displayName: string;
  externalConnectionId: string;
  institutionId: string;
  provider: string;
  userId: string;
}) {
  const existing = await db
    .from('provider_connections')
    .select('id')
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('external_connection_id', externalConnectionId)
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  if (existing.data?.id) {
    return existing.data.id as string;
  }

  const inserted = await db
    .from('provider_connections')
    .insert({
      display_name: displayName,
      external_connection_id: externalConnectionId,
      institution_id: institutionId,
      metadata: {
        source: 'bank-link'
      },
      provider,
      status: 'active',
      user_id: userId
    })
    .select('id')
    .single();

  if (inserted.error) {
    throw inserted.error;
  }

  return inserted.data.id as string;
}

async function loadConnection({
  connectionId,
  db,
  provider,
  userId
}: {
  connectionId?: string | null;
  db: SupabaseClient;
  provider: string;
  userId: string;
}) {
  const query = connectionId
    ? await db
        .from('provider_connections')
        .select(
          'id, display_name, external_connection_id, institution_id, provider, status, link_state, retry_count, next_retry_at, last_attempted_at, last_success_at, last_error_code, last_error_message'
        )
        .eq('id', connectionId)
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle()
    : await db
        .from('provider_connections')
        .select(
          'id, display_name, external_connection_id, institution_id, provider, status, link_state, retry_count, next_retry_at, last_attempted_at, last_success_at, last_error_code, last_error_message'
        )
        .eq('user_id', userId)
        .eq('provider', provider)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

  if (query.error) {
    if (isMissingColumnError(query.error)) {
      const fallbackQuery = connectionId
        ? await db
            .from('provider_connections')
            .select('id, display_name, external_connection_id, institution_id, provider, status')
            .eq('id', connectionId)
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle()
        : await db
            .from('provider_connections')
            .select('id, display_name, external_connection_id, institution_id, provider, status')
            .eq('user_id', userId)
            .eq('provider', provider)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

      if (fallbackQuery.error) {
        throw fallbackQuery.error;
      }

      return (fallbackQuery.data as ConnectionStateRow | null) ?? null;
    }

    throw query.error;
  }

  return (query.data as ConnectionStateRow | null) ?? null;
}

async function touchConnectionState({
  clearError = false,
  connectionId,
  db,
  incrementRetry = false,
  lastErrorCode,
  lastErrorMessage,
  markAttempted = false,
  markSuccess = false,
  nextRetryAt,
  state,
  userId
}: {
  clearError?: boolean;
  connectionId: string;
  db: SupabaseClient;
  incrementRetry?: boolean;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  markAttempted?: boolean;
  markSuccess?: boolean;
  nextRetryAt?: string | null;
  state: ConnectorLinkState;
  userId: string;
}) {
  const current = await db
    .from('provider_connections')
    .select('retry_count')
    .eq('id', connectionId)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  let retryCount = incrementRetry ? 1 : 0;

  if (current.error) {
    if (!isMissingColumnError(current.error)) {
      throw current.error;
    }
  } else if (incrementRetry) {
    const parsedCurrent =
      typeof current.data?.retry_count === 'number'
        ? current.data.retry_count
        : Number.parseInt(String(current.data?.retry_count ?? 0), 10) || 0;
    retryCount = parsedCurrent + 1;
  }

  const payload: JsonRecord = {
    link_state: state
  };

  if (markAttempted) {
    payload.last_attempted_at = new Date().toISOString();
  }

  if (markSuccess) {
    payload.last_success_at = new Date().toISOString();
    payload.retry_count = 0;
    payload.next_retry_at = null;
  } else if (incrementRetry) {
    payload.retry_count = retryCount;
    payload.next_retry_at = nextRetryAt ?? nextRetryAtIso(retryCount);
  } else if (nextRetryAt !== undefined) {
    payload.next_retry_at = nextRetryAt;
  }

  if (clearError) {
    payload.last_error_code = null;
    payload.last_error_message = null;
  } else {
    payload.last_error_code = lastErrorCode ?? null;
    payload.last_error_message = lastErrorMessage ?? null;
  }

  const update = await db
    .from('provider_connections')
    .update(payload)
    .eq('id', connectionId)
    .eq('user_id', userId);

  if (update.error && !isMissingColumnError(update.error)) {
    throw update.error;
  }

  return {
    nextRetryAt: (payload.next_retry_at as string | null | undefined) ?? null,
    retryCount
  };
}

async function upsertBankLinkSession({
  connectionId,
  db,
  expiresAt,
  institutionName,
  metadata,
  provider,
  providerInstitutionId,
  providerSessionId,
  status,
  userId
}: {
  connectionId?: string | null;
  db: SupabaseClient;
  expiresAt?: string | null;
  institutionName?: string | null;
  metadata?: JsonRecord;
  provider: string;
  providerInstitutionId?: string | null;
  providerSessionId: string;
  status: 'created' | 'exchanged' | 'synced' | 'failed' | 'expired';
  userId: string;
}) {
  const linkTokenHint = providerSessionId.slice(-8);
  const inserted = await db
    .from('bank_link_sessions')
    .insert({
      connection_id: connectionId ?? null,
      expires_at: expiresAt ?? null,
      institution_name: institutionName ?? null,
      link_token_hint: linkTokenHint,
      metadata: metadata ?? {},
      provider,
      provider_institution_id: providerInstitutionId ?? null,
      provider_session_id: providerSessionId,
      status,
      user_id: userId
    })
    .select('id')
    .single();

  if (inserted.error) {
    if (isMissingTableError(inserted.error)) {
      return null;
    }

    throw inserted.error;
  }

  return inserted.data.id as string;
}

async function touchSessionStatus({
  connectionId,
  db,
  metadata,
  sessionId,
  status,
  userId
}: {
  connectionId?: string | null;
  db: SupabaseClient;
  metadata?: JsonRecord;
  sessionId: string;
  status: 'exchanged' | 'synced' | 'failed' | 'expired';
  userId: string;
}) {
  const updated = await db
    .from('bank_link_sessions')
    .update({
      connection_id: connectionId ?? null,
      metadata: metadata ?? {},
      status
    })
    .eq('id', sessionId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();

  if (updated.error && !isMissingTableError(updated.error)) {
    throw updated.error;
  }

  return updated.data?.id ?? null;
}

async function readSession({
  db,
  sessionId,
  userId
}: {
  db: SupabaseClient;
  sessionId: string;
  userId: string;
}) {
  const query = await db
    .from('bank_link_sessions')
    .select('id, provider, provider_institution_id, institution_name, expires_at')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (query.error) {
    if (isMissingTableError(query.error)) {
      return null;
    }

    throw query.error;
  }

  return query.data;
}

async function upsertBankAccount({
  balance,
  connectionId,
  db,
  institutionId,
  name,
  provider,
  providerAccountId,
  subtype,
  userId,
  visualColor: accountColor
}: {
  balance: number;
  connectionId: string;
  db: SupabaseClient;
  institutionId: string;
  name: string;
  provider: string;
  providerAccountId: string;
  subtype: string;
  userId: string;
  visualColor: string;
}) {
  const result = await db
    .from('accounts')
    .upsert(
      {
        available_balance: balance,
        currency_code: 'INR',
        current_balance: balance,
        institution_id: institutionId,
        is_manual: false,
        kind: 'bank',
        metadata: {
          account_label: 'Banking',
          change_label: '0.00%',
          source: 'bank-link',
          visual_color: accountColor
        },
        name,
        provider,
        provider_account_id: providerAccountId,
        provider_connection_id: connectionId,
        status: 'active',
        subtype,
        user_id: userId
      },
      {
        onConflict: 'user_id,provider,provider_account_id'
      }
    )
    .select('name, current_balance, metadata')
    .single();

  if (result.error) {
    throw result.error;
  }

  const metadata = (result.data.metadata ?? {}) as JsonRecord;

  return {
    changeLabel:
      typeof metadata.change_label === 'string' ? metadata.change_label : '0.00%',
    currentBalance:
      typeof result.data.current_balance === 'number'
        ? result.data.current_balance
        : Number.parseFloat(String(result.data.current_balance ?? 0)) || 0,
    label: typeof metadata.account_label === 'string' ? metadata.account_label : 'Banking',
    name: result.data.name as string,
    visualColor:
      typeof metadata.visual_color === 'string' ? metadata.visual_color : accountColor
  };
}

type LinkConnection = {
  display_name: string | null;
  external_connection_id: string | null;
  id: string;
  institution_id: string | null;
  provider: string | null;
};

type SyncTransactionItem = {
  accountProviderAccountId?: string | null;
  amount: number;
  bookedAt: string;
  description?: string | null;
  direction?: string | null;
  id: string;
  merchantName: string;
  metadata?: JsonRecord;
};

function parsedNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizeDirection(direction: unknown, amount: number) {
  const normalizedDirection =
    typeof direction === 'string' ? direction.toLowerCase() : null;
  const absoluteAmount = Math.abs(amount);

  if (normalizedDirection === 'credit' || normalizedDirection === 'transfer') {
    return {
      amount: absoluteAmount,
      direction: normalizedDirection
    };
  }

  if (normalizedDirection === 'debit') {
    return {
      amount: absoluteAmount,
      direction: 'debit'
    };
  }

  if (amount < 0) {
    return {
      amount: absoluteAmount,
      direction: 'credit'
    };
  }

  return {
    amount: absoluteAmount,
    direction: 'debit'
  };
}

function toIsoTimestamp(value: unknown) {
  if (typeof value === 'string') {
    const candidate = new Date(value);

    if (!Number.isNaN(candidate.getTime())) {
      return candidate.toISOString();
    }
  }

  return new Date().toISOString();
}

function generateMockTransactions(connection: LinkConnection): SyncTransactionItem[] {
  const merchants = [
    { description: 'Groceries order', merchantName: 'Blinkit' },
    { description: 'Cab ride', merchantName: 'Uber' },
    { description: 'Monthly streaming', merchantName: 'Netflix' },
    { description: 'Dinner', merchantName: 'Swiggy' },
    { description: 'Coconut water subscription', merchantName: 'Coconut' },
    { description: 'Coffee', merchantName: 'Chaayos' },
    { description: 'Rent payment', merchantName: 'Rent' },
    { description: 'Clothing', merchantName: 'H&M' },
    { description: 'Pharmacy bill', merchantName: 'Apollo Medical' },
    { description: 'Refund', merchantName: 'Cashback Refund' }
  ];
  const seed = hashCode(connection.id + (connection.external_connection_id ?? ''));

  return merchants.map((entry, index) => {
    const date = new Date();
    date.setDate(date.getDate() - index);
    date.setHours(10 + (index % 6), 14 + (index * 7) % 40, 0, 0);

    const amount = 120 + ((seed + index * 137) % 2100);

    return {
      accountProviderAccountId: connection.external_connection_id,
      amount,
      bookedAt: date.toISOString(),
      description: entry.description,
      direction: entry.merchantName === 'Cashback Refund' ? 'credit' : 'debit',
      id: `${connection.id}-mock-${index}-${date.getTime()}`,
      merchantName: entry.merchantName
    };
  });
}

async function upsertLinkedTransactions({
  connection,
  db,
  provider,
  transactions,
  userId
}: {
  connection: LinkConnection;
  db: SupabaseClient;
  provider: string;
  transactions: SyncTransactionItem[];
  userId: string;
}) {
  const accountRows = await db
    .from('accounts')
    .select('id, provider_account_id')
    .eq('user_id', userId)
    .eq('provider_connection_id', connection.id);

  if (accountRows.error) {
    throw accountRows.error;
  }

  const accountIdByProvider = new Map<string, string>();
  let firstAccountId: string | null = null;

  for (const row of accountRows.data ?? []) {
    if (!firstAccountId) {
      firstAccountId = row.id as string;
    }

    if (typeof row.provider_account_id === 'string' && row.provider_account_id.trim()) {
      accountIdByProvider.set(row.provider_account_id, row.id as string);
    }
  }

  let insertedCount = 0;

  for (const entry of transactions) {
    const merchantName = entry.merchantName.trim();
    const providerTransactionId = entry.id.trim();

    if (!merchantName || !providerTransactionId) {
      continue;
    }

    const amountValue = parsedNumber(entry.amount);
    const normalized = normalizeDirection(entry.direction, amountValue);

    if (!normalized.amount) {
      continue;
    }

    const accountId = entry.accountProviderAccountId
      ? accountIdByProvider.get(entry.accountProviderAccountId) ?? firstAccountId
      : firstAccountId;
    const inferredCategory = inferCategoryLabel(
      `${merchantName} ${entry.description ?? ''}`.trim()
    );

    const txResult = await db
      .from('transactions')
      .upsert(
        {
          account_id: accountId ?? null,
          amount: normalized.amount,
          booked_at: toIsoTimestamp(entry.bookedAt),
          currency_code: 'INR',
          description: entry.description ?? null,
          direction: normalized.direction,
          manual: false,
          merchant_name: merchantName,
          metadata: {
            category_label: inferredCategory,
            raw_provider_payload: entry.metadata ?? {},
            source: 'bank-link-sync'
          },
          pending: false,
          provider,
          provider_transaction_id: providerTransactionId,
          review_required: false,
          user_id: userId
        },
        {
          onConflict: 'user_id,provider,provider_transaction_id'
        }
      );

    if (txResult.error) {
      throw txResult.error;
    }

    insertedCount += 1;
  }

  return insertedCount;
}

function providerAuthHeaders() {
  const clientId = Deno.env.get('BANK_LINK_CLIENT_ID')?.trim();
  const clientSecret = Deno.env.get('BANK_LINK_CLIENT_SECRET')?.trim();
  const partnerApiKey = Deno.env.get('BANK_LINK_PARTNER_API_KEY')?.trim();
  const partnerBearerToken = Deno.env.get('BANK_LINK_PARTNER_BEARER_TOKEN')?.trim();
  const headers: Record<string, string> = {};

  if (clientId && clientSecret) {
    headers.Authorization = `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
  } else if (partnerBearerToken) {
    headers.Authorization = `Bearer ${partnerBearerToken}`;
  }

  if (partnerApiKey) {
    headers['x-api-key'] = partnerApiKey;
  }

  return headers;
}

function providerEndpoint({
  fallbackPath,
  keyedEnv
}: {
  fallbackPath: string;
  keyedEnv: string;
}) {
  const explicit = Deno.env.get(keyedEnv)?.trim();

  if (explicit) {
    return explicit;
  }

  const baseUrl = Deno.env.get('BANK_LINK_API_BASE_URL')?.trim();

  if (!baseUrl) {
    return null;
  }

  return `${baseUrl.replace(/\/$/, '')}${fallbackPath}`;
}

async function providerExchangePublicToken({
  ctx,
  institutionName,
  providerInstitutionId,
  publicToken
}: {
  ctx: AuthContext;
  institutionName?: string | null;
  providerInstitutionId?: string | null;
  publicToken: string;
}) {
  if (ctx.provider === 'mock') {
    return {
      externalConnectionId: `mock-exchange-${publicToken.slice(-12).replace(/[^a-zA-Z0-9]/g, '') || crypto.randomUUID().slice(0, 8)}`,
      institutionName: institutionName ?? 'Linked Institution',
      providerInstitutionId:
        providerInstitutionId ?? `manual-${crypto.randomUUID().slice(0, 8)}`,
      requiresSync: true
    };
  }

  const endpoint = providerEndpoint({
    fallbackPath: '/link/token/exchange',
    keyedEnv: 'BANK_LINK_EXCHANGE_ENDPOINT'
  });

  if (!endpoint) {
    throw new ProviderRequestError(
      'Provider exchange endpoint is not configured.',
      {
        code: 'provider_exchange_unconfigured',
        retryable: false
      }
    );
  }

  const payload = await providerRequest<JsonRecord>(
    endpoint,
    {
      institution_id: providerInstitutionId,
      institution_name: institutionName,
      provider: ctx.provider,
      public_token: publicToken,
      user_id: ctx.userId
    },
    {
      headers: providerAuthHeaders(),
      pathLabel: 'Provider token exchange'
    }
  );

  const externalConnectionId =
    optionalString(payload.connection_id) ??
    optionalString(payload.external_connection_id) ??
    optionalString(payload.id);
  const responseInstitutionId =
    optionalString(payload.institution_id) ??
    optionalString(payload.provider_institution_id);
  const responseInstitutionName =
    optionalString(payload.institution_name) ??
    optionalString(payload.display_name) ??
    institutionName;

  if (!externalConnectionId) {
    throw new ProviderRequestError(
      'Provider exchange response is missing connection id.',
      {
        code: 'provider_exchange_bad_payload',
        retryable: false
      }
    );
  }

  return {
    externalConnectionId,
    institutionName: responseInstitutionName ?? 'Linked Institution',
    providerInstitutionId:
      responseInstitutionId ?? providerInstitutionId ?? `manual-${crypto.randomUUID().slice(0, 8)}`,
    requiresSync: true
  };
}

async function createProviderLinkToken({
  ctx,
  institutionName,
  providerInstitutionId
}: {
  ctx: AuthContext;
  institutionName?: string | null;
  providerInstitutionId?: string | null;
}) {
  const providerSessionId = crypto.randomUUID();
  const defaultExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  if (ctx.provider === 'mock') {
    const linkToken = `mock-link-${providerSessionId}`;

    return {
      expiresAt: defaultExpires,
      linkToken,
      providerSessionId
    };
  }

  const endpoint = providerEndpoint({
    fallbackPath: '/link/token/create',
    keyedEnv: 'BANK_LINK_CREATE_SESSION_ENDPOINT'
  });

  if (!endpoint) {
    throw new ProviderRequestError(
      'Provider link endpoint is not configured.',
      {
        code: 'provider_link_unconfigured',
        retryable: false
      }
    );
  }

  const payload = await providerRequest<JsonRecord>(
    endpoint,
    {
      institution_id: providerInstitutionId,
      institution_name: institutionName,
      provider: ctx.provider,
      user_id: ctx.userId
    },
    {
      headers: providerAuthHeaders(),
      pathLabel: 'Provider link-token request'
    }
  );
  const linkToken =
    optionalString(payload.link_token) ??
    optionalString(payload.linkToken);

  if (!linkToken) {
    throw new ProviderRequestError(
      'Provider response did not include a link token.',
      {
        code: 'provider_link_bad_payload',
        retryable: false
      }
    );
  }

  const responseProviderSessionId =
    optionalString(payload.session_id) ??
    optionalString(payload.link_session_id) ??
    providerSessionId;

  return {
    expiresAt:
      optionalString(payload.expiration) ??
      optionalString(payload.expires_at) ??
      defaultExpires,
    linkToken,
    providerSessionId: responseProviderSessionId
  };
}

async function handleCreateLinkSession(ctx: AuthContext, body: JsonRecord) {
  const institutionName = optionalString(body.institutionName);
  const providerInstitutionId = optionalString(body.providerInstitutionId);

  const token = await createProviderLinkToken({
    ctx,
    institutionName,
    providerInstitutionId
  });

  const storedSessionId =
    (await upsertBankLinkSession({
      db: ctx.db,
      expiresAt: token.expiresAt,
      institutionName,
      metadata: {
        created_via: 'edge-function'
      },
      provider: ctx.provider,
      providerInstitutionId,
      providerSessionId: token.providerSessionId,
      status: 'created',
      userId: ctx.userId
    })) ?? token.providerSessionId;

  return success({
    expiresAt: token.expiresAt,
    linkToken: token.linkToken,
    provider: ctx.provider,
    sessionId: storedSessionId
  });
}

async function handleExchangePublicToken(ctx: AuthContext, body: JsonRecord) {
  const sessionId = optionalString(body.sessionId);
  const publicToken = optionalString(body.publicToken);

  if (!sessionId) {
    return failure(400, 'sessionId is required.');
  }

  if (!publicToken) {
    return failure(400, 'publicToken is required.');
  }

  const session = await readSession({
    db: ctx.db,
    sessionId,
    userId: ctx.userId
  });

  const requestedProviderInstitutionId =
    optionalString(body.providerInstitutionId) ??
    optionalString(session?.provider_institution_id) ??
    null;

  const requestedInstitutionName =
    optionalString(body.institutionName) ??
    optionalString(session?.institution_name) ??
    null;

  let exchanged: Awaited<ReturnType<typeof providerExchangePublicToken>>;

  try {
    exchanged = await providerExchangePublicToken({
      ctx,
      institutionName: requestedInstitutionName,
      providerInstitutionId: requestedProviderInstitutionId,
      publicToken
    });
  } catch (error) {
    await touchSessionStatus({
      db: ctx.db,
      metadata: {
        error_message: error instanceof Error ? error.message : 'Provider token exchange failed.'
      },
      sessionId,
      status: 'failed',
      userId: ctx.userId
    });

    throw error;
  }

  const institutionId = await ensureInstitutionId({
    db: ctx.db,
    institutionName: exchanged.institutionName,
    provider: ctx.provider,
    providerInstitutionId: exchanged.providerInstitutionId,
    userId: ctx.userId
  });

  const connectionId = await ensureConnectionId({
    db: ctx.db,
    displayName: exchanged.institutionName,
    externalConnectionId: exchanged.externalConnectionId,
    institutionId,
    provider: ctx.provider,
    userId: ctx.userId
  });

  await touchConnectionState({
    clearError: true,
    connectionId,
    db: ctx.db,
    markAttempted: true,
    nextRetryAt: null,
    state: 'token_exchanged',
    userId: ctx.userId
  });

  await touchSessionStatus({
    connectionId,
    db: ctx.db,
    metadata: {
      exchanged_via: 'edge-function',
      token_hint: publicToken.slice(-6)
    },
    sessionId,
    status: 'exchanged',
    userId: ctx.userId
  });

  return success({
    connectionId,
    provider: ctx.provider,
    requiresSync: exchanged.requiresSync,
    status: 'pending_sync'
  });
}

async function handleSyncAccounts(ctx: AuthContext, body: JsonRecord) {
  const requestedConnectionId = optionalString(body.connectionId);
  const connection = await loadConnection({
    connectionId: requestedConnectionId,
    db: ctx.db,
    provider: ctx.provider,
    userId: ctx.userId
  });

  if (!connection) {
    return failure(404, 'No linked bank connection found.');
  }

  const connectionId = connection.id as string;
  const institutionId = connection.institution_id as string | null;
  const providerForConnection = optionalString(connection.provider) ?? ctx.provider;

  if (!institutionId) {
    return failure(409, 'Connection is missing institution mapping.');
  }

  await touchConnectionState({
    clearError: true,
    connectionId,
    db: ctx.db,
    markAttempted: true,
    state: 'syncing_accounts',
    userId: ctx.userId
  });

  try {
    if (providerForConnection === 'mock') {
      const displayName =
        optionalString(connection.display_name) ?? 'Connected Bank';
      const externalConnectionId =
        optionalString(connection.external_connection_id) ??
        `mock-${crypto.randomUUID().slice(0, 8)}`;
      const balance = predictedBalance(externalConnectionId);
      const accountSnapshot = await upsertBankAccount({
        balance,
        connectionId,
        db: ctx.db,
        institutionId,
        name: displayName,
        provider: 'mock-bank-link',
        providerAccountId: externalConnectionId,
        subtype: 'savings',
        userId: ctx.userId,
        visualColor: visualColor(displayName)
      });

      await touchConnectionState({
        clearError: true,
        connectionId,
        db: ctx.db,
        markSuccess: true,
        nextRetryAt: null,
        state: 'connected',
        userId: ctx.userId
      });

      return success({
        accounts: [accountSnapshot],
        connectionId,
        provider: providerForConnection,
        syncedAt: new Date().toISOString()
      });
    }

    const syncEndpoint = providerEndpoint({
      fallbackPath: '/accounts/sync',
      keyedEnv: 'BANK_LINK_SYNC_ENDPOINT'
    });

    if (!syncEndpoint) {
      throw new ProviderRequestError(
        'Provider accounts sync endpoint is not configured.',
        {
          code: 'provider_accounts_unconfigured',
          retryable: false
        }
      );
    }

    const payload = await providerRequest<JsonRecord>(
      syncEndpoint,
      {
        connection_id: connectionId,
        provider: providerForConnection,
        user_id: ctx.userId
      },
      {
        headers: providerAuthHeaders(),
        pathLabel: 'Provider account sync'
      }
    );
    const accounts = Array.isArray(payload.accounts) ? payload.accounts : [];
    const upserted: JsonRecord[] = [];

    for (const entry of accounts) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const record = entry as JsonRecord;
      const accountId =
        optionalString(record.account_id) ??
        optionalString(record.id);
      const accountName =
        optionalString(record.name) ??
        optionalString(record.display_name);
      const currentBalance =
        typeof record.current_balance === 'number'
          ? record.current_balance
          : Number.parseFloat(String(record.current_balance ?? 0)) || 0;

      if (!accountId || !accountName) {
        continue;
      }

      const snapshot = await upsertBankAccount({
        balance: currentBalance,
        connectionId,
        db: ctx.db,
        institutionId,
        name: accountName,
        provider: providerForConnection,
        providerAccountId: accountId,
        subtype: optionalString(record.subtype) ?? 'savings',
        userId: ctx.userId,
        visualColor: visualColor(accountName)
      });

      upserted.push(snapshot);
    }

    await touchConnectionState({
      clearError: true,
      connectionId,
      db: ctx.db,
      markSuccess: true,
      nextRetryAt: null,
      state: 'connected',
      userId: ctx.userId
    });

    return success({
      accounts: upserted,
      connectionId,
      provider: providerForConnection,
      syncedAt: new Date().toISOString()
    });
  } catch (error) {
    const normalized =
      error instanceof ProviderRequestError
        ? error
        : new ProviderRequestError(
            error instanceof Error ? error.message : 'Provider account sync failed.',
            {
              code: 'provider_accounts_failed',
              retryable: true
            }
          );

    const nextState: ConnectorLinkState = normalized.retryable ? 'retry_scheduled' : 'error';
    const stateInfo = await touchConnectionState({
      connectionId,
      db: ctx.db,
      incrementRetry: normalized.retryable,
      lastErrorCode: normalized.code ?? null,
      lastErrorMessage: normalized.message,
      markAttempted: true,
      nextRetryAt: normalized.retryable ? undefined : null,
      state: nextState,
      userId: ctx.userId
    });

    return failure(
      normalized.statusCode ?? (normalized.retryable ? 502 : 500),
      normalized.message,
      {
        connectionId,
        provider: providerForConnection,
        retryAt: normalized.retryable ? stateInfo.nextRetryAt : null
      }
    );
  }
}

async function handleSyncTransactions(ctx: AuthContext, body: JsonRecord) {
  const requestedConnectionId = optionalString(body.connectionId);
  const connection = await loadConnection({
    connectionId: requestedConnectionId,
    db: ctx.db,
    provider: ctx.provider,
    userId: ctx.userId
  });

  if (!connection) {
    return failure(404, 'No linked bank connection found.');
  }

  const providerForConnection = optionalString(connection.provider) ?? ctx.provider;
  const typedConnection = connection as LinkConnection;

  await touchConnectionState({
    clearError: true,
    connectionId: typedConnection.id,
    db: ctx.db,
    markAttempted: true,
    state: 'syncing_transactions',
    userId: ctx.userId
  });

  try {
    let items: SyncTransactionItem[] = [];

    if (providerForConnection === 'mock') {
      items = generateMockTransactions(typedConnection);
    } else {
      const transactionsEndpoint = providerEndpoint({
        fallbackPath: '/transactions/sync',
        keyedEnv: 'BANK_LINK_TRANSACTIONS_ENDPOINT'
      });

      if (!transactionsEndpoint) {
        throw new ProviderRequestError(
          'Provider transactions endpoint is not configured.',
          {
            code: 'provider_transactions_unconfigured',
            retryable: false
          }
        );
      }

      const payload = await providerRequest<JsonRecord>(
        transactionsEndpoint,
        {
          connection_id: typedConnection.id,
          provider: providerForConnection,
          user_id: ctx.userId
        },
        {
          headers: providerAuthHeaders(),
          pathLabel: 'Provider transaction sync'
        }
      );
      const providerTransactions = Array.isArray(payload.transactions)
        ? payload.transactions
        : [];

      items = providerTransactions
        .map((entry) => {
          if (!entry || typeof entry !== 'object') {
            return null;
          }

          const record = entry as JsonRecord;
          const id =
            optionalString(record.provider_transaction_id) ??
            optionalString(record.transaction_id) ??
            optionalString(record.id);
          const merchantName =
            optionalString(record.merchant_name) ??
            optionalString(record.merchant) ??
            optionalString(record.name) ??
            optionalString(record.description);
          const amount = parsedNumber(record.amount);

          if (!id || !merchantName || !amount) {
            return null;
          }

          return {
            accountProviderAccountId:
              optionalString(record.provider_account_id) ??
              optionalString(record.account_id),
            amount,
            bookedAt:
              optionalString(record.booked_at) ??
              optionalString(record.posted_at) ??
              optionalString(record.date) ??
              new Date().toISOString(),
            description: optionalString(record.description),
            direction: optionalString(record.direction),
            id,
            merchantName,
            metadata: {
              raw: record
            }
          } as SyncTransactionItem;
        })
        .filter((entry): entry is SyncTransactionItem => Boolean(entry));
    }

    const insertedCount = await upsertLinkedTransactions({
      connection: typedConnection,
      db: ctx.db,
      provider: providerForConnection === 'mock' ? 'mock-bank-link' : providerForConnection,
      transactions: items,
      userId: ctx.userId
    });

    await touchConnectionState({
      clearError: true,
      connectionId: typedConnection.id,
      db: ctx.db,
      markSuccess: true,
      nextRetryAt: null,
      state: 'connected',
      userId: ctx.userId
    });

    return success({
      connectionId: typedConnection.id,
      insertedCount,
      provider: providerForConnection,
      syncedAt: new Date().toISOString()
    });
  } catch (error) {
    const normalized =
      error instanceof ProviderRequestError
        ? error
        : new ProviderRequestError(
            error instanceof Error ? error.message : 'Provider transaction sync failed.',
            {
              code: 'provider_transactions_failed',
              retryable: true
            }
          );

    const nextState: ConnectorLinkState = normalized.retryable ? 'retry_scheduled' : 'error';
    const stateInfo = await touchConnectionState({
      connectionId: typedConnection.id,
      db: ctx.db,
      incrementRetry: normalized.retryable,
      lastErrorCode: normalized.code ?? null,
      lastErrorMessage: normalized.message,
      markAttempted: true,
      nextRetryAt: normalized.retryable ? undefined : null,
      state: nextState,
      userId: ctx.userId
    });

    return failure(
      normalized.statusCode ?? (normalized.retryable ? 502 : 500),
      normalized.message,
      {
        connectionId: typedConnection.id,
        provider: providerForConnection,
        retryAt: normalized.retryable ? stateInfo.nextRetryAt : null
      }
    );
  }
}

async function startStatementImportBatch({
  accountId,
  connectionId,
  db,
  fileHash,
  fileName,
  fileType,
  provider,
  rowCount,
  userId
}: {
  accountId?: string | null;
  connectionId?: string | null;
  db: SupabaseClient;
  fileHash: string;
  fileName?: string | null;
  fileType?: string | null;
  provider: string;
  rowCount: number;
  userId: string;
}) {
  const insert = await db
    .from('statement_import_batches')
    .insert({
      account_id: accountId ?? null,
      connection_id: connectionId ?? null,
      file_hash: fileHash,
      file_name: fileName ?? null,
      file_type: fileType ?? null,
      provider,
      row_count: rowCount,
      started_at: new Date().toISOString(),
      status: 'running',
      user_id: userId
    })
    .select('id')
    .single();

  if (insert.error) {
    if (isMissingTableError(insert.error)) {
      return null;
    }

    throw insert.error;
  }

  return insert.data.id as string;
}

async function finishStatementImportBatch({
  batchId,
  db,
  errorMessage,
  failedCount,
  insertedCount,
  skippedCount,
  userId
}: {
  batchId: string | null;
  db: SupabaseClient;
  errorMessage?: string | null;
  failedCount: number;
  insertedCount: number;
  skippedCount: number;
  userId: string;
}) {
  if (!batchId) {
    return;
  }

  const status = errorMessage ? 'failed' : 'succeeded';
  const update = await db
    .from('statement_import_batches')
    .update({
      error_message: errorMessage ?? null,
      failed_count: failedCount,
      finished_at: new Date().toISOString(),
      inserted_count: insertedCount,
      skipped_count: skippedCount,
      status
    })
    .eq('id', batchId)
    .eq('user_id', userId);

  if (update.error && !isMissingTableError(update.error)) {
    throw update.error;
  }
}

async function ensureStatementConnection({
  accountName,
  ctx,
  requestedConnectionId
}: {
  accountName?: string | null;
  ctx: AuthContext;
  requestedConnectionId?: string | null;
}) {
  const existing = requestedConnectionId
    ? await loadConnection({
        connectionId: requestedConnectionId,
        db: ctx.db,
        provider: ctx.provider,
        userId: ctx.userId
      })
    : await loadConnection({
        db: ctx.db,
        provider: 'statement-import',
        userId: ctx.userId
      });

  if (existing) {
    return existing;
  }

  const institutionName = accountName ?? 'Statement Import';
  const providerInstitutionId = `statement-${normalizeSlug(institutionName)}`;
  const institutionId = await ensureInstitutionId({
    db: ctx.db,
    institutionName,
    provider: 'statement-import',
    providerInstitutionId,
    userId: ctx.userId
  });
  const externalConnectionId = `statement-${hashCode(`${ctx.userId}-${Date.now()}-${institutionName}`)}`;
  const connectionId = await ensureConnectionId({
    db: ctx.db,
    displayName: institutionName,
    externalConnectionId,
    institutionId,
    provider: 'statement-import',
    userId: ctx.userId
  });

  await touchConnectionState({
    clearError: true,
    connectionId,
    db: ctx.db,
    nextRetryAt: null,
    state: 'token_exchanged',
    userId: ctx.userId
  });

  return (
    (await loadConnection({
      connectionId,
      db: ctx.db,
      provider: 'statement-import',
      userId: ctx.userId
    })) ?? null
  );
}

async function ensureStatementAccountId({
  accountName,
  connection,
  ctx
}: {
  accountName?: string | null;
  connection: ConnectionStateRow;
  ctx: AuthContext;
}) {
  const accountQuery = await ctx.db
    .from('accounts')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('provider_connection_id', connection.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (accountQuery.error) {
    throw accountQuery.error;
  }

  if (accountQuery.data?.id) {
    return accountQuery.data.id as string;
  }

  const derivedName =
    accountName ??
    optionalString(connection.display_name) ??
    'Statement Account';
  const providerAccountId =
    optionalString(connection.external_connection_id) ??
    `statement-${hashCode(`${connection.id}-${derivedName}`)}`;
  const insert = await ctx.db
    .from('accounts')
    .insert({
      available_balance: 0,
      current_balance: 0,
      currency_code: 'INR',
      institution_id: connection.institution_id ?? null,
      is_manual: true,
      kind: 'bank',
      metadata: {
        account_label: 'Statement Import',
        change_label: '0.00%',
        source: 'statement-import',
        visual_color: visualColor(derivedName)
      },
      name: derivedName,
      provider: 'statement-import',
      provider_account_id: providerAccountId,
      provider_connection_id: connection.id,
      status: 'active',
      subtype: 'savings',
      user_id: ctx.userId
    })
    .select('id')
    .single();

  if (insert.error) {
    throw insert.error;
  }

  return insert.data.id as string;
}

function stableStatementTransactionId({
  amount,
  bookedAt,
  connectionId,
  index,
  merchantName
}: {
  amount: number;
  bookedAt: string;
  connectionId: string;
  index: number;
  merchantName: string;
}) {
  const seed = `${connectionId}|${bookedAt}|${merchantName.toLowerCase()}|${amount.toFixed(2)}|${index}`;
  return `statement-${hashCode(seed)}`;
}

async function handleImportStatement(ctx: AuthContext, body: JsonRecord) {
  const requestedConnectionId = optionalString(body.connectionId);
  const accountName = optionalString(body.accountName);
  const fileName = optionalString(body.fileName);
  const fileType = optionalString(body.fileType);
  const entries = Array.isArray(body.entries) ? body.entries : [];

  if (!entries.length) {
    return failure(400, 'entries is required and must contain at least one item.');
  }

  const connection = await ensureStatementConnection({
    accountName,
    ctx,
    requestedConnectionId
  });

  if (!connection) {
    return failure(404, 'Unable to prepare statement import connection.');
  }

  const accountId = await ensureStatementAccountId({
    accountName,
    connection,
    ctx
  });

  await touchConnectionState({
    clearError: true,
    connectionId: connection.id,
    db: ctx.db,
    markAttempted: true,
    state: 'syncing_transactions',
    userId: ctx.userId
  });

  const fileHash = `statement-${hashCode(`${fileName ?? 'upload'}-${entries.length}-${connection.id}`)}`;
  const batchId = await startStatementImportBatch({
    accountId,
    connectionId: connection.id,
    db: ctx.db,
    fileHash,
    fileName,
    fileType,
    provider: 'statement-import',
    rowCount: entries.length,
    userId: ctx.userId
  });

  let insertedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  try {
    for (let index = 0; index < entries.length; index += 1) {
      const raw = entries[index];

      if (!raw || typeof raw !== 'object') {
        skippedCount += 1;
        continue;
      }

      const record = raw as JsonRecord;
      const rawAmount = parsedNumber(record.amount);
      const merchantName =
        optionalString(record.merchant_name) ??
        optionalString(record.merchant) ??
        optionalString(record.description) ??
        'Statement entry';
      const amount = Math.abs(rawAmount);
      const bookedAt = toIsoTimestamp(
        optionalString(record.booked_at) ??
          optionalString(record.posted_at) ??
          optionalString(record.date)
      );
      const direction = optionalString(record.direction) ?? (rawAmount < 0 ? 'credit' : 'debit');

      if (!amount || !merchantName) {
        skippedCount += 1;
        continue;
      }

      const inferredCategory = inferCategoryLabel(
        `${merchantName} ${optionalString(record.description) ?? ''}`.trim()
      );
      const providerTransactionId =
        optionalString(record.provider_transaction_id) ??
        optionalString(record.transaction_id) ??
        optionalString(record.id) ??
        stableStatementTransactionId({
          amount,
          bookedAt,
          connectionId: connection.id,
          index,
          merchantName
        });

      const upsert = await ctx.db
        .from('transactions')
        .upsert(
          {
            account_id: accountId,
            amount,
            booked_at: bookedAt,
            currency_code: 'INR',
            description: optionalString(record.description),
            direction: direction === 'credit' ? 'credit' : 'debit',
            manual: true,
            merchant_name: merchantName,
            metadata: {
              category_label: inferredCategory,
              file_name: fileName,
              import_batch_id: batchId,
              source: 'statement-import'
            },
            pending: false,
            provider: 'statement-import',
            provider_transaction_id: providerTransactionId,
            review_required: false,
            user_id: ctx.userId
          },
          {
            onConflict: 'user_id,provider,provider_transaction_id'
          }
        );

      if (upsert.error) {
        failedCount += 1;
        continue;
      }

      insertedCount += 1;
    }

    await finishStatementImportBatch({
      batchId,
      db: ctx.db,
      failedCount,
      insertedCount,
      skippedCount,
      userId: ctx.userId
    });

    await touchConnectionState({
      clearError: true,
      connectionId: connection.id,
      db: ctx.db,
      markSuccess: true,
      nextRetryAt: null,
      state: 'connected',
      userId: ctx.userId
    });

    return success({
      batchId,
      connectionId: connection.id,
      failedCount,
      insertedCount,
      provider: 'statement-import',
      skippedCount
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Statement import failed.';

    await finishStatementImportBatch({
      batchId,
      db: ctx.db,
      errorMessage: message,
      failedCount: failedCount + 1,
      insertedCount,
      skippedCount,
      userId: ctx.userId
    });

    await touchConnectionState({
      connectionId: connection.id,
      db: ctx.db,
      incrementRetry: false,
      lastErrorCode: 'statement_import_failed',
      lastErrorMessage: message,
      markAttempted: true,
      nextRetryAt: null,
      state: 'error',
      userId: ctx.userId
    });

    return failure(500, message, {
      batchId,
      connectionId: connection.id
    });
  }
}

async function decodeResponsePayload(response: Response) {
  try {
    return (await response.clone().json()) as JsonRecord;
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Unable to decode response payload.',
      success: false
    } as JsonRecord;
  }
}

async function handleRetryConnectionSync(ctx: AuthContext, body: JsonRecord) {
  const connectionId = optionalString(body.connectionId);
  const scope = optionalString(body.scope) ?? 'all';

  if (!connectionId) {
    return failure(400, 'connectionId is required.');
  }

  const responseData: JsonRecord = {
    connectionId
  };

  if (scope !== 'transactions') {
    const accountsResponse = await handleSyncAccounts(ctx, {
      connectionId
    });
    const accountsPayload = await decodeResponsePayload(accountsResponse);

    if (accountsPayload.success !== true) {
      return accountsResponse;
    }

    responseData.accounts = accountsPayload.data;
  }

  if (scope !== 'accounts') {
    const transactionsResponse = await handleSyncTransactions(ctx, {
      connectionId
    });
    const transactionsPayload = await decodeResponsePayload(transactionsResponse);

    if (transactionsPayload.success !== true) {
      return transactionsResponse;
    }

    responseData.transactions = transactionsPayload.data;
  }

  return success(responseData);
}

async function handleGetConnectionState(ctx: AuthContext, body: JsonRecord) {
  const requestedConnectionId = optionalString(body.connectionId);
  const connection = await loadConnection({
    connectionId: requestedConnectionId,
    db: ctx.db,
    provider: ctx.provider,
    userId: ctx.userId
  });

  if (!connection) {
    return success({
      connection: null
    });
  }

  return success({
    connection: {
      displayName: optionalString(connection.display_name),
      id: connection.id,
      lastAttemptedAt: optionalString(connection.last_attempted_at),
      lastErrorCode: optionalString(connection.last_error_code),
      lastErrorMessage: optionalString(connection.last_error_message),
      lastSuccessAt: optionalString(connection.last_success_at),
      nextRetryAt: optionalString(connection.next_retry_at),
      provider: optionalString(connection.provider) ?? ctx.provider,
      retryCount:
        typeof connection.retry_count === 'number'
          ? connection.retry_count
          : Number.parseInt(String(connection.retry_count ?? 0), 10) || 0,
      state: optionalString(connection.link_state) ?? 'idle',
      status: optionalString(connection.status) ?? 'active'
    }
  });
}

async function handleMockMobileVerify(ctx: AuthContext, body: JsonRecord) {
  const bankName = optionalString(body.bankName);
  const mobileNumber = digitsOnly(body.mobileNumber, 10);
  const otp = digitsOnly(body.otp, 6);
  const expectedOtp = Deno.env.get('BANK_LINK_MOCK_OTP')?.trim() || '123456';

  if (!bankName) {
    return failure(400, 'bankName is required.');
  }

  if (mobileNumber.length !== 10) {
    return failure(400, 'A valid 10-digit mobile number is required.');
  }

  if (otp !== expectedOtp) {
    return failure(401, 'Invalid OTP.');
  }

  const providerInstitutionId = normalizeSlug(bankName);
  const institutionId = await ensureInstitutionId({
    db: ctx.db,
    institutionName: bankName,
    provider: 'mock',
    providerInstitutionId,
    userId: ctx.userId
  });

  const externalConnectionId = `mock-${providerInstitutionId}-${mobileNumber.slice(-4)}`;

  const connectionId = await ensureConnectionId({
    db: ctx.db,
    displayName: bankName,
    externalConnectionId,
    institutionId,
    provider: 'mock',
    userId: ctx.userId
  });

  const accountSnapshot = await upsertBankAccount({
    balance: predictedBalance(`${bankName}-${mobileNumber}`),
    connectionId,
    db: ctx.db,
    institutionId,
    name: bankName,
    provider: 'mock-bank-link',
    providerAccountId: externalConnectionId,
    subtype: 'savings',
    userId: ctx.userId,
    visualColor: visualColor(bankName)
  });

  await touchConnectionState({
    clearError: true,
    connectionId,
    db: ctx.db,
    markAttempted: true,
    markSuccess: true,
    nextRetryAt: null,
    state: 'connected',
    userId: ctx.userId
  });

  await upsertBankLinkSession({
    connectionId,
    db: ctx.db,
    institutionName: bankName,
    metadata: {
      linked_mobile_last4: mobileNumber.slice(-4),
      method: 'otp-mock',
      verified_at: new Date().toISOString()
    },
    provider: 'mock',
    providerInstitutionId,
    providerSessionId: crypto.randomUUID(),
    status: 'synced',
    userId: ctx.userId
  });

  return success({
    account: accountSnapshot,
    connectionId,
    provider: 'mock'
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return failure(405, 'Method not allowed.');
  }

  try {
    const payload = (await req.json()) as JsonRecord;
    const action = optionalString(payload.action);

    if (!action) {
      return failure(400, 'Missing action.');
    }

    const ctx = await authContext(req);

    if (action === 'create_link_session') {
      return await handleCreateLinkSession(ctx, payload);
    }

    if (action === 'exchange_public_token') {
      return await handleExchangePublicToken(ctx, payload);
    }

    if (action === 'sync_accounts') {
      return await handleSyncAccounts(ctx, payload);
    }

    if (action === 'sync_transactions') {
      return await handleSyncTransactions(ctx, payload);
    }

    if (action === 'retry_connection_sync') {
      return await handleRetryConnectionSync(ctx, payload);
    }

    if (action === 'get_connection_state') {
      return await handleGetConnectionState(ctx, payload);
    }

    if (action === 'import_statement') {
      return await handleImportStatement(ctx, payload);
    }

    if (action === 'mock_mobile_verify') {
      return await handleMockMobileVerify(ctx, payload);
    }

    return failure(400, `Unsupported action: ${action}`);
  } catch (error) {
    const dbError = asDbError(error);

    if (dbError.message === 'Unauthorized') {
      return failure(401, 'Unauthorized');
    }

    const message =
      error instanceof Error ? error.message : 'Unexpected server error.';

    return failure(500, message);
  }
});
