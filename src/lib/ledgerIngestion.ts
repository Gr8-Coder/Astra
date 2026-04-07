import { supabase } from './supabase';

export type LedgerTransactionDirection = 'credit' | 'debit' | 'transfer';

export type LedgerIngestEvent = {
  accountId?: string | null;
  amount: number;
  bookedAt: Date;
  categoryId?: string | null;
  currencyCode?: string;
  direction: LedgerTransactionDirection;
  idempotencyKey?: string;
  manual?: boolean;
  merchant: string;
  metadata?: Record<string, unknown>;
  provider: string;
  providerTransactionId: string;
  rawPayload?: Record<string, unknown>;
};

export type LedgerIngestInput = {
  events: LedgerIngestEvent[];
  scope?: string;
  source: string;
  userId: string;
};

export type LedgerIngestResult = {
  failedCount: number;
  insertedCount: number;
  matchedCount: number;
  scannedCount: number;
  syncRunId: string | null;
  updatedCount: number;
};

type SyncRunRow = {
  id: string;
};

type ExistingTransactionKeyRow = {
  provider: string | null;
  provider_transaction_id: string | null;
};

type SourceEventRow = {
  error_message?: string | null;
  idempotency_key: string;
  metadata: Record<string, unknown>;
  normalized_payload: Record<string, unknown>;
  occurred_at: string;
  payload: Record<string, unknown>;
  processed_at?: string | null;
  provider: string;
  scope: string;
  status: 'failed' | 'queued' | 'running' | 'succeeded';
  sync_run_id: string | null;
  user_id: string;
};

function normalizeText(value: string) {
  return value.trim();
}

function roundedAmount(value: number) {
  return Math.round(Math.abs(value) * 100) / 100;
}

function buildSourceEventIdempotencyKey(event: LedgerIngestEvent) {
  if (event.idempotencyKey?.trim()) {
    return event.idempotencyKey.trim();
  }

  return `${event.provider}:${event.providerTransactionId}`;
}

function toTransactionConflictKey(provider: string, providerTransactionId: string) {
  return `${provider}::${providerTransactionId}`;
}

function eventToSourceRow({
  event,
  scope,
  status,
  syncRunId,
  userId
}: {
  event: LedgerIngestEvent;
  scope: string;
  status: 'failed' | 'queued' | 'running' | 'succeeded';
  syncRunId: string | null;
  userId: string;
}): SourceEventRow {
  const normalizedPayload: Record<string, unknown> = {
    account_id: event.accountId ?? null,
    amount: roundedAmount(event.amount),
    booked_at: event.bookedAt.toISOString(),
    category_id: event.categoryId ?? null,
    currency_code: event.currencyCode ?? 'INR',
    direction: event.direction,
    manual: Boolean(event.manual),
    merchant_name: normalizeText(event.merchant),
    provider: normalizeText(event.provider),
    provider_transaction_id: normalizeText(event.providerTransactionId)
  };

  return {
    idempotency_key: buildSourceEventIdempotencyKey(event),
    metadata: {
      source: scope
    },
    normalized_payload: normalizedPayload,
    occurred_at: event.bookedAt.toISOString(),
    payload: event.rawPayload ?? {
      event
    },
    provider: normalizeText(event.provider),
    scope,
    status,
    sync_run_id: syncRunId,
    user_id: userId
  };
}

function toTransactionRow(userId: string, event: LedgerIngestEvent) {
  return {
    account_id: event.accountId ?? null,
    amount: roundedAmount(event.amount),
    booked_at: event.bookedAt.toISOString(),
    category_id: event.categoryId ?? null,
    currency_code: event.currencyCode ?? 'INR',
    direction: event.direction,
    manual: Boolean(event.manual),
    merchant_name: normalizeText(event.merchant),
    metadata: event.metadata ?? {},
    pending: false,
    provider: normalizeText(event.provider),
    provider_transaction_id: normalizeText(event.providerTransactionId),
    user_id: userId
  };
}

async function createSyncRun({
  provider,
  scope,
  source,
  userId
}: {
  provider: string;
  scope: string;
  source: string;
  userId: string;
}) {
  const { data, error } = await supabase
    .from('sync_runs')
    .insert({
      metadata: {
        source
      },
      provider,
      scope,
      started_at: new Date().toISOString(),
      status: 'running',
      user_id: userId
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return (data as SyncRunRow).id;
}

async function finalizeSyncRun({
  durationMs,
  failedCount,
  insertedCount,
  matchedCount,
  scannedCount,
  status,
  syncRunId,
  updatedCount
}: {
  durationMs: number;
  failedCount: number;
  insertedCount: number;
  matchedCount: number;
  scannedCount: number;
  status: 'failed' | 'succeeded';
  syncRunId: string;
  updatedCount: number;
}) {
  const { error } = await supabase
    .from('sync_runs')
    .update({
      duration_ms: durationMs,
      failed_count: failedCount,
      finished_at: new Date().toISOString(),
      inserted_count: insertedCount,
      matched_count: matchedCount,
      scanned_count: scannedCount,
      status,
      updated_count: updatedCount
    })
    .eq('id', syncRunId);

  if (error) {
    throw error;
  }
}

async function markSourceEvents({
  errorMessage,
  rows,
  status
}: {
  errorMessage?: string;
  rows: SourceEventRow[];
  status: 'failed' | 'succeeded';
}) {
  if (!rows.length) {
    return;
  }

  const payload = rows.map((row) => ({
    ...row,
    error_message: status === 'failed' ? errorMessage ?? 'Ingestion failed' : null,
    processed_at: new Date().toISOString(),
    status
  }));

  const { error } = await supabase
    .from('source_events')
    .upsert(payload, { onConflict: 'user_id,provider,idempotency_key' });

  if (error) {
    throw error;
  }
}

async function preloadExistingTransactionKeys(userId: string, events: LedgerIngestEvent[]) {
  const providerMap = new Map<string, string[]>();

  events.forEach((event) => {
    const provider = normalizeText(event.provider);
    const providerTransactionId = normalizeText(event.providerTransactionId);

    if (!provider || !providerTransactionId) {
      return;
    }

    const current = providerMap.get(provider) ?? [];
    providerMap.set(provider, [...current, providerTransactionId]);
  });

  const existing = new Set<string>();

  for (const [provider, providerTransactionIds] of providerMap.entries()) {
    if (!providerTransactionIds.length) {
      continue;
    }

    const { data, error } = await supabase
      .from('transactions')
      .select('provider, provider_transaction_id')
      .eq('user_id', userId)
      .eq('provider', provider)
      .in('provider_transaction_id', providerTransactionIds);

    if (error) {
      throw error;
    }

    ((data as ExistingTransactionKeyRow[] | null) ?? []).forEach((row) => {
      const rowProvider = row.provider?.trim();
      const rowProviderTransactionId = row.provider_transaction_id?.trim();

      if (!rowProvider || !rowProviderTransactionId) {
        return;
      }

      existing.add(toTransactionConflictKey(rowProvider, rowProviderTransactionId));
    });
  }

  return existing;
}

export async function ingestTransactions({
  events,
  scope = 'transactions',
  source,
  userId
}: LedgerIngestInput): Promise<LedgerIngestResult> {
  if (!events.length) {
    return {
      failedCount: 0,
      insertedCount: 0,
      matchedCount: 0,
      scannedCount: 0,
      syncRunId: null,
      updatedCount: 0
    };
  }

  const startedAt = Date.now();
  const primaryProvider = normalizeText(events[0]?.provider ?? 'astra');
  const syncRunId = await createSyncRun({
    provider: primaryProvider,
    scope,
    source,
    userId
  });

  const normalizedEvents = events.filter((event) => {
    const merchant = normalizeText(event.merchant);
    const provider = normalizeText(event.provider);
    const providerTransactionId = normalizeText(event.providerTransactionId);
    const amount = roundedAmount(event.amount);

    return Boolean(
      merchant &&
        provider &&
        providerTransactionId &&
        Number.isFinite(amount) &&
        amount > 0
    );
  });

  const scannedCount = events.length;
  const matchedCount = normalizedEvents.length;
  const failedCount = scannedCount - matchedCount;
  const sourceRows = normalizedEvents.map((event) =>
    eventToSourceRow({
      event,
      scope,
      status: 'queued',
      syncRunId,
      userId
    })
  );

  try {
    const { error: sourceInsertError } = await supabase
      .from('source_events')
      .upsert(sourceRows, { onConflict: 'user_id,provider,idempotency_key' });

    if (sourceInsertError) {
      throw sourceInsertError;
    }

    if (!normalizedEvents.length) {
      await finalizeSyncRun({
        durationMs: Date.now() - startedAt,
        failedCount,
        insertedCount: 0,
        matchedCount,
        scannedCount,
        status: 'succeeded',
        syncRunId,
        updatedCount: 0
      });

      return {
        failedCount,
        insertedCount: 0,
        matchedCount,
        scannedCount,
        syncRunId,
        updatedCount: 0
      };
    }

    const existingKeys = await preloadExistingTransactionKeys(userId, normalizedEvents);
    const rows = normalizedEvents.map((event) => toTransactionRow(userId, event));

    const { error: upsertError } = await supabase
      .from('transactions')
      .upsert(rows, { onConflict: 'user_id,provider,provider_transaction_id' });

    if (upsertError) {
      throw upsertError;
    }

    const updatedCount = normalizedEvents.filter((event) =>
      existingKeys.has(
        toTransactionConflictKey(normalizeText(event.provider), normalizeText(event.providerTransactionId))
      )
    ).length;
    const insertedCount = normalizedEvents.length - updatedCount;

    await markSourceEvents({
      rows: sourceRows,
      status: 'succeeded'
    });

    await finalizeSyncRun({
      durationMs: Date.now() - startedAt,
      failedCount,
      insertedCount,
      matchedCount,
      scannedCount,
      status: 'succeeded',
      syncRunId,
      updatedCount
    });

    return {
      failedCount,
      insertedCount,
      matchedCount,
      scannedCount,
      syncRunId,
      updatedCount
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown ingestion error';

    try {
      await markSourceEvents({
        errorMessage,
        rows: sourceRows,
        status: 'failed'
      });
      await finalizeSyncRun({
        durationMs: Date.now() - startedAt,
        failedCount: scannedCount,
        insertedCount: 0,
        matchedCount,
        scannedCount,
        status: 'failed',
        syncRunId,
        updatedCount: 0
      });
    } catch (finalizeError) {
      console.warn('[ledgerIngestion] failed to finalize ingestion run', finalizeError);
    }

    throw error;
  }
}
