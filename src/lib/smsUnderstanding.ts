import type { SmsTransactionDraft } from './androidSms';
import { supabase } from './supabase';

type SmsUnderstandingInvokeResponse<T> = {
  data: T;
  success: boolean;
};

type SmsUnderstandingInvokeFailure = {
  error?: string;
  message?: string;
  statusCode?: number;
  success?: boolean;
};

type SmsUnderstandingFunctionInput = {
  accountMask?: string;
  amount: number;
  bankName?: string;
  bookedAt: string;
  direction: 'credit' | 'debit';
  merchant: string;
  providerTransactionId: string;
  rawBody: string;
  sender: string;
};

type SmsUnderstandingResultRow = {
  categoryLabel: string;
  confidence: number;
  isRecurring: boolean;
  normalizedBankName: string | null;
  normalizedMerchant: string;
  providerTransactionId: string;
  reason: string;
};

type SmsUnderstandingBatchResult = {
  model: string;
  promptVersion: string;
  results: SmsUnderstandingResultRow[];
  usedFallback: boolean;
};

type SmsUnderstandingEnrichmentResult = {
  model: string | null;
  promptVersion: string | null;
  transactions: SmsTransactionDraft[];
  usedFallback: boolean;
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

function chunkTransactions(items: SmsTransactionDraft[], chunkSize = 20) {
  const chunks: SmsTransactionDraft[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

function toFunctionInput(items: SmsTransactionDraft[]): SmsUnderstandingFunctionInput[] {
  return items.map((item) => ({
    accountMask: item.accountMask,
    amount: item.amount,
    bankName: item.bankName,
    bookedAt: item.bookedAt.toISOString(),
    direction: item.direction,
    merchant: item.merchant,
    providerTransactionId: item.providerTransactionId,
    rawBody: item.rawBody,
    sender: item.sender
  }));
}

async function invokeSmsUnderstandingBatch(items: SmsTransactionDraft[]) {
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const { data, error } = await supabase.functions.invoke('sms-understanding', {
      body: {
        action: 'understand_sms_batch',
        items: toFunctionInput(items)
      }
    });

    if (error) {
      if (attempt < maxAttempts && isTransientInvokeError(error)) {
        await delay(260 * attempt);
        continue;
      }

      throw error;
    }

    const payload = data as
      | SmsUnderstandingInvokeResponse<SmsUnderstandingBatchResult>
      | SmsUnderstandingInvokeFailure
      | null;

    if (!payload) {
      throw new Error('SMS understanding returned an empty response.');
    }

    if ('success' in payload && payload.success === false) {
      throw new Error(responseMessage(payload) ?? 'SMS understanding failed.');
    }

    if (!('success' in payload) || !payload.success || !('data' in payload) || !payload.data) {
      throw new Error('SMS understanding returned an invalid response.');
    }

    return payload.data;
  }

  throw new Error('SMS understanding failed after retry.');
}

export async function enrichSmsTransactionsWithOpenAI(
  items: SmsTransactionDraft[]
): Promise<SmsUnderstandingEnrichmentResult> {
  if (!items.length) {
    return {
      model: null,
      promptVersion: null,
      transactions: items,
      usedFallback: false
    };
  }

  const mergedItems = items.map((item) => ({ ...item }));
  let responseModel: string | null = null;
  let responsePromptVersion: string | null = null;
  let usedFallback = false;

  for (const chunk of chunkTransactions(mergedItems)) {
    try {
      const batch = await invokeSmsUnderstandingBatch(chunk);
      const resultById = new Map(
        batch.results.map((result) => [result.providerTransactionId, result] as const)
      );

      responseModel = batch.model;
      responsePromptVersion = batch.promptVersion;
      usedFallback = usedFallback || batch.usedFallback;

      chunk.forEach((item) => {
        const result = resultById.get(item.providerTransactionId);

        if (!result) {
          return;
        }

        item.aiCategoryLabel = result.categoryLabel;
        item.aiConfidence = result.confidence;
        item.aiEngine = batch.usedFallback ? 'astra-heuristic-sms-v1' : 'openai-responses';
        item.aiIsRecurring = result.isRecurring;
        item.aiModelVersion = batch.model;
        item.aiPromptVersion = batch.promptVersion;
        item.aiReason = result.reason;
        item.aiUsedFallback = batch.usedFallback;
        item.bankName = result.normalizedBankName ?? item.bankName;
        item.merchant = result.normalizedMerchant || item.merchant;
      });
    } catch (error) {
      console.warn('[sms-understanding] batch enrichment failed; using local fallback', error);
      usedFallback = true;
    }
  }

  return {
    model: responseModel,
    promptVersion: responsePromptVersion,
    transactions: mergedItems,
    usedFallback
  };
}
