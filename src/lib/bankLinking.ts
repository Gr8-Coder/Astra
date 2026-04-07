import { supabase } from './supabase';

type BankLinkInvokeResponse<T> = {
  data: T;
  success: boolean;
};

type BankLinkInvokeFailure = {
  error?: string;
  errorCode?: string;
  message?: string;
  retryAt?: string | null;
  statusCode?: number;
  success?: boolean;
};

export type BankLinkSession = {
  expiresAt: string;
  linkToken: string;
  provider: string;
  sessionId: string;
};

export type ExchangedBankConnection = {
  connectionId: string;
  provider: string;
  requiresSync: boolean;
  status: 'connected' | 'pending_sync';
};

export type BankAccountSnapshot = {
  changeLabel?: string;
  currentBalance: number;
  label?: string;
  name: string;
  visualColor?: string;
};

export type SyncedBankAccounts = {
  accounts: BankAccountSnapshot[];
  connectionId?: string;
  provider: string;
  syncedAt: string;
};

export type SyncedTransactions = {
  connectionId?: string;
  insertedCount: number;
  provider: string;
  syncedAt: string;
};

export type BankConnectionState = {
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

export type RetryConnectionScope = 'accounts' | 'all' | 'transactions';

export type RetriedConnectionSync = {
  accounts?: SyncedBankAccounts;
  connectionId: string;
  transactions?: SyncedTransactions;
};

export type StatementImportEntry = {
  amount: number;
  bookedAt?: string;
  description?: string;
  direction?: 'credit' | 'debit';
  merchant?: string;
  merchantName?: string;
  providerTransactionId?: string;
};

export type StatementImportResult = {
  batchId?: string | null;
  connectionId: string;
  failedCount: number;
  insertedCount: number;
  provider: string;
  skippedCount: number;
};

export class BankLinkFunctionError extends Error {
  errorCode?: string;
  retryAt?: string | null;
  statusCode?: number;

  constructor(
    message: string,
    options?: {
      errorCode?: string;
      retryAt?: string | null;
      statusCode?: number;
    }
  ) {
    super(message);
    this.name = 'BankLinkFunctionError';
    this.errorCode = options?.errorCode;
    this.retryAt = options?.retryAt;
    this.statusCode = options?.statusCode;
  }
}

type CreateLinkSessionInput = {
  institutionName?: string;
  providerInstitutionId?: string;
};

type ExchangePublicTokenInput = {
  institutionName?: string;
  providerInstitutionId?: string;
  publicToken: string;
  sessionId: string;
};

type SyncAccountsInput = {
  connectionId?: string;
};

type SyncTransactionsInput = {
  connectionId?: string;
};

type VerifyByOtpInput = {
  bankName: string;
  mobileNumber: string;
  otp: string;
};

type VerifyByOtpResult = {
  account: BankAccountSnapshot;
  connectionId: string;
  provider: string;
};

type RetryConnectionSyncInput = {
  connectionId: string;
  scope?: RetryConnectionScope;
};

type GetConnectionStateInput = {
  connectionId?: string;
};

type GetConnectionStateResult = {
  connection: BankConnectionState | null;
};

type ImportStatementInput = {
  accountName?: string;
  connectionId?: string;
  entries: StatementImportEntry[];
  fileName?: string;
  fileType?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function responseMessage(data: unknown) {
  if (isRecord(data) && typeof data.error === 'string') {
    return data.error;
  }

  if (isRecord(data) && typeof data.message === 'string') {
    return data.message;
  }

  return null;
}

function isTransientInvokeError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes('network') ||
    message.includes('timed out') ||
    message.includes('timeout') ||
    message.includes('failed to fetch') ||
    message.includes('failed to send a request')
  );
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function invokeBankLink<T>(payload: Record<string, unknown>) {
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const { data, error } = await supabase.functions.invoke('bank-link', {
      body: payload
    });

    if (error) {
      if (attempt < maxAttempts && isTransientInvokeError(error)) {
        await delay(260 * attempt);
        continue;
      }

      throw new BankLinkFunctionError(error.message);
    }

    if (!isRecord(data)) {
      throw new BankLinkFunctionError('Invalid bank-link response payload.');
    }

    const failurePayload = data as BankLinkInvokeFailure;
    const statusCode =
      typeof failurePayload.statusCode === 'number' ? failurePayload.statusCode : undefined;
    const success = data.success === true;

    if (!success) {
      throw new BankLinkFunctionError(
        responseMessage(data) ?? 'Bank-link action failed.',
        {
          errorCode:
            typeof failurePayload.errorCode === 'string' ? failurePayload.errorCode : undefined,
          retryAt:
            typeof failurePayload.retryAt === 'string' || failurePayload.retryAt === null
              ? failurePayload.retryAt
              : undefined,
          statusCode
        }
      );
    }

    const typed = data as BankLinkInvokeResponse<T>;

    if (!typed.success) {
      throw new BankLinkFunctionError('Bank-link action returned unsuccessful result.', {
        statusCode
      });
    }

    return typed.data;
  }

  throw new BankLinkFunctionError('Bank-link action could not be completed.');
}

export async function createBankLinkSession(input: CreateLinkSessionInput = {}) {
  return invokeBankLink<BankLinkSession>({
    action: 'create_link_session',
    ...input
  });
}

export async function exchangeProviderPublicToken(input: ExchangePublicTokenInput) {
  return invokeBankLink<ExchangedBankConnection>({
    action: 'exchange_public_token',
    ...input
  });
}

export async function syncLinkedBankAccounts(input: SyncAccountsInput = {}) {
  return invokeBankLink<SyncedBankAccounts>({
    action: 'sync_accounts',
    ...input
  });
}

export async function syncLinkedTransactions(input: SyncTransactionsInput = {}) {
  return invokeBankLink<SyncedTransactions>({
    action: 'sync_transactions',
    ...input
  });
}

export async function verifyBankByOtp(input: VerifyByOtpInput) {
  return invokeBankLink<VerifyByOtpResult>({
    action: 'mock_mobile_verify',
    ...input
  });
}

export async function getLinkedBankConnectionState(input: GetConnectionStateInput = {}) {
  return invokeBankLink<GetConnectionStateResult>({
    action: 'get_connection_state',
    ...input
  });
}

export async function retryLinkedBankConnectionSync(input: RetryConnectionSyncInput) {
  return invokeBankLink<RetriedConnectionSync>({
    action: 'retry_connection_sync',
    ...input
  });
}

export async function importStatementTransactionsFallback(input: ImportStatementInput) {
  return invokeBankLink<StatementImportResult>({
    accountName: input.accountName,
    action: 'import_statement',
    connectionId: input.connectionId,
    entries: input.entries.map((entry) => ({
      amount: entry.amount,
      booked_at: entry.bookedAt,
      description: entry.description,
      direction: entry.direction,
      merchant: entry.merchant ?? entry.merchantName,
      provider_transaction_id: entry.providerTransactionId
    })),
    fileName: input.fileName,
    fileType: input.fileType
  });
}

export function isFunctionUnavailable(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes('edge function') &&
    (message.includes('404') ||
      message.includes('failed to send a request') ||
      message.includes('not found'))
  );
}
