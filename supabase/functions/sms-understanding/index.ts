import OpenAI from 'npm:openai@latest';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json'
};

const promptVersion = 'sms-understanding-v1';
const fallbackModelVersion = 'astra-sms-heuristic-v1';
const defaultOpenAiModel = Deno.env.get('OPENAI_SMS_MODEL')?.trim() || 'gpt-4o-mini';

const canonicalCategories = [
  'Income',
  'Rent',
  'Food & Drink',
  'Groceries',
  'Restaurant',
  'Coffee',
  'Travel',
  'Travel & Vacation',
  'Clothing',
  'Shopping',
  'Shop',
  'Healthcare',
  'Entertainment',
  'Utilities',
  'Streaming',
  'Car & Transport',
  'Gym',
  'Other'
] as const;

type JsonRecord = Record<string, unknown>;

type SmsDirection = 'credit' | 'debit';

type AuthContext = {
  db: SupabaseClient;
  userId: string;
};

type SmsUnderstandingInput = {
  accountMask?: string | null;
  amount: number;
  bankName?: string | null;
  bookedAt?: string | null;
  direction: SmsDirection;
  merchant: string;
  providerTransactionId: string;
  rawBody: string;
  sender: string;
};

type TrainingExample = {
  categoryLabel: string;
  direction: string;
  manual: boolean;
  merchant: string;
  source: string;
  txRawBody?: string;
};

type HeuristicResult = {
  categoryLabel: string;
  confidence: number;
  isRecurring: boolean;
  normalizedBankName: string | null;
  normalizedMerchant: string;
  providerTransactionId: string;
  reason: string;
};

type OpenAiStructuredResult = {
  categoryLabel: string;
  confidence: number;
  isRecurring: boolean;
  normalizedBankName: string | null;
  normalizedMerchant: string;
  providerTransactionId: string;
  reason: string;
};

type TransactionsExampleRow = {
  direction: string | null;
  manual: boolean | null;
  merchant_name: string;
  metadata: Record<string, unknown> | null;
};

const categoryAliasMap: Record<string, (typeof canonicalCategories)[number]> = {
  'car & transport': 'Car & Transport',
  'car and transport': 'Car & Transport',
  'food & drink': 'Food & Drink',
  'food and drink': 'Food & Drink',
  coffee: 'Coffee',
  entertainment: 'Entertainment',
  groceries: 'Groceries',
  gym: 'Gym',
  health: 'Healthcare',
  healthcare: 'Healthcare',
  income: 'Income',
  other: 'Other',
  rent: 'Rent',
  restaurant: 'Restaurant',
  shopping: 'Shopping',
  shop: 'Shop',
  shops: 'Shop',
  streaming: 'Streaming',
  travel: 'Travel',
  'travel & vacation': 'Travel & Vacation',
  utilities: 'Utilities'
};

const bankNamePatterns: Array<{ label: string; pattern: RegExp }> = [
  { label: 'ICICI Bank', pattern: /\bicici\b/i },
  { label: 'HDFC Bank', pattern: /\bhdfc\b/i },
  { label: 'State Bank of India', pattern: /\b(?:sbi|state bank of india)\b/i },
  { label: 'Canara Bank', pattern: /\b(?:canara|canbnk|cnrb)\b/i },
  { label: 'HSBC Bank', pattern: /\bhsbc\b/i },
  { label: 'Axis Bank', pattern: /\baxis\b/i },
  { label: 'Kotak Mahindra Bank', pattern: /\bkotak\b/i },
  { label: 'Punjab National Bank', pattern: /\b(?:pnb|punjab national)\b/i },
  { label: 'YES Bank', pattern: /\b(?:yes bank|yesbnk)\b/i },
  { label: 'IDFC FIRST Bank', pattern: /\bidfc\b/i },
  { label: 'Union Bank of India', pattern: /\bunion\b/i },
  { label: 'Bank of India', pattern: /\bboi\b/i },
  { label: 'IndusInd Bank', pattern: /\bindus(?:ind|b)\b/i },
  { label: 'Bandhan Bank', pattern: /\b(?:bandhan|bandhn)\b/i },
  { label: 'Paytm Payments Bank', pattern: /\bpaytm\b/i }
];

const keywordCategoryRules: Array<{ keywords: string[]; label: (typeof canonicalCategories)[number] }> = [
  {
    keywords: ['spotify', 'netflix', 'hotstar', 'disney', 'prime', 'audible', 'youtube', 'yt music'],
    label: 'Streaming'
  },
  {
    keywords: ['rent', 'landlord', 'lease', 'tenant'],
    label: 'Rent'
  },
  {
    keywords: ['uber', 'ola', 'rapido', 'taxi', 'metro', 'cab', 'commute', 'fuel', 'petrol'],
    label: 'Car & Transport'
  },
  {
    keywords: ['blinkit', 'zepto', 'instamart', 'grocer', 'supermarket', 'dmart', 'bigbasket'],
    label: 'Groceries'
  },
  {
    keywords: ['swiggy', 'zomato', 'tiffin', 'meal', 'food', 'coconut', 'smoothie', 'juice', 'snack'],
    label: 'Food & Drink'
  },
  {
    keywords: ['restaurant', 'taco', 'burger', 'pizza', 'kfc', 'mcdonald', 'dominos', 'eatery'],
    label: 'Restaurant'
  },
  {
    keywords: ['coffee', 'cafe', 'chaayos', 'starbucks', 'blue tokai'],
    label: 'Coffee'
  },
  {
    keywords: ['shop', 'store', 'marketplace', 'crosswords'],
    label: 'Shop'
  },
  {
    keywords: ['shopping', 'mall'],
    label: 'Shopping'
  },
  {
    keywords: ['clothing', 'apparel', 'fashion', 'h&m', 'zara', 'uniqlo'],
    label: 'Clothing'
  },
  {
    keywords: ['trip', 'flight', 'hotel', 'airbnb', 'vacation', 'holiday', 'booking'],
    label: 'Travel & Vacation'
  },
  {
    keywords: ['movie', 'cinema', 'entertainment', 'bookmyshow'],
    label: 'Entertainment'
  },
  {
    keywords: ['electricity', 'water bill', 'internet', 'broadband', 'gas', 'wifi', 'mobile bill'],
    label: 'Utilities'
  },
  {
    keywords: ['pharmacy', 'medical', 'apollo', 'doctor', 'health', 'hospital'],
    label: 'Healthcare'
  },
  {
    keywords: ['gym', 'fitness', 'workout', 'cult fit'],
    label: 'Gym'
  }
];

const recurringKeywords = [
  'subscription',
  'renewal',
  'premium',
  'membership',
  'monthly',
  'bill',
  'rent',
  'sip',
  'emi',
  'insurance',
  'broadband',
  'recharge',
  'utility'
];

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['results'],
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'providerTransactionId',
          'categoryLabel',
          'normalizedMerchant',
          'normalizedBankName',
          'confidence',
          'isRecurring',
          'reason'
        ],
        properties: {
          providerTransactionId: {
            type: 'string'
          },
          categoryLabel: {
            type: 'string',
            enum: [...canonicalCategories]
          },
          normalizedMerchant: {
            type: 'string'
          },
          normalizedBankName: {
            anyOf: [{ type: 'string' }, { type: 'null' }]
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1
          },
          isRecurring: {
            type: 'boolean'
          },
          reason: {
            type: 'string'
          }
        }
      }
    }
  }
};

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

  const nextValue = value.trim();
  return nextValue ? nextValue : null;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeText(value: string) {
  return normalizeWhitespace(value).toLowerCase();
}

function titleCase(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => {
      if (part.length <= 3 && /^[a-z0-9&]+$/i.test(part)) {
        return part.toUpperCase();
      }

      return `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`;
    })
    .join(' ');
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function smartMerchantName(value: string) {
  const cleaned = normalizeWhitespace(
    value
      .replace(/\b(ref|utr|txn|txnid|trxn|ifsc)\b.*$/i, '')
      .replace(/\b(?:upi id|vpa)\b.*$/i, '')
      .replace(/\s*@\s*[a-z0-9._-]+$/i, '')
      .replace(/[|]/g, ' ')
  );

  if (!cleaned) {
    return 'Bank transaction';
  }

  if (/^[a-z0-9 .&-]+$/i.test(cleaned)) {
    return titleCase(cleaned);
  }

  return cleaned;
}

function normalizeCategoryLabel(label: string | null | undefined, direction: SmsDirection) {
  if (direction === 'credit') {
    return 'Income';
  }

  const normalized = normalizeText(label ?? '');
  const alias = categoryAliasMap[normalized];

  if (alias) {
    return alias;
  }

  const exact = canonicalCategories.find((item) => normalizeText(item) === normalized);
  return exact ?? 'Other';
}

function normalizeBankName(value: string | null | undefined, rawBody: string) {
  const directValue = optionalString(value);

  if (directValue) {
    const directMatch = bankNamePatterns.find((entry) => entry.pattern.test(directValue));
    return directMatch?.label ?? titleCase(directValue);
  }

  const bodyMatch = bankNamePatterns.find((entry) => entry.pattern.test(rawBody));
  return bodyMatch?.label ?? null;
}

function recentMerchantExampleMap(examples: TrainingExample[]) {
  const map = new Map<string, TrainingExample>();

  examples.forEach((example) => {
    const key = normalizeText(example.merchant);

    if (!key || map.has(key)) {
      return;
    }

    map.set(key, example);
  });

  return map;
}

function fallbackCategoryLabel(item: SmsUnderstandingInput, examples: TrainingExample[]) {
  if (item.direction === 'credit') {
    return 'Income';
  }

  const merchantMap = recentMerchantExampleMap(examples);
  const merchantExample = merchantMap.get(normalizeText(item.merchant));

  if (merchantExample?.categoryLabel) {
    return normalizeCategoryLabel(merchantExample.categoryLabel, item.direction);
  }

  const combined = normalizeText([item.merchant, item.rawBody].join(' '));
  const matchedRule = keywordCategoryRules.find((rule) =>
    rule.keywords.some((keyword) => combined.includes(keyword))
  );

  return matchedRule?.label ?? 'Other';
}

function heuristicRecurring(item: SmsUnderstandingInput, examples: TrainingExample[]) {
  const combined = normalizeText([item.merchant, item.rawBody].join(' '));

  if (recurringKeywords.some((keyword) => combined.includes(keyword))) {
    return true;
  }

  const matchingMerchantCount = examples.filter(
    (example) => normalizeText(example.merchant) === normalizeText(item.merchant)
  ).length;

  return matchingMerchantCount >= 2;
}

function heuristicReason(item: SmsUnderstandingInput, categoryLabel: string, examples: TrainingExample[]) {
  const merchantExample = recentMerchantExampleMap(examples).get(normalizeText(item.merchant));

  if (merchantExample?.categoryLabel) {
    return `Matched your earlier ${merchantExample.categoryLabel} pattern for ${smartMerchantName(item.merchant)}.`;
  }

  if (item.direction === 'credit') {
    return 'Credit message mapped to Income by default.';
  }

  return `Matched Astra fallback rules for ${categoryLabel}.`;
}

function heuristicResult(item: SmsUnderstandingInput, examples: TrainingExample[]): HeuristicResult {
  const categoryLabel = fallbackCategoryLabel(item, examples);

  return {
    categoryLabel,
    confidence: item.direction === 'credit' ? 0.9 : 0.68,
    isRecurring: heuristicRecurring(item, examples),
    normalizedBankName: normalizeBankName(item.bankName, item.rawBody),
    normalizedMerchant: smartMerchantName(item.merchant),
    providerTransactionId: item.providerTransactionId,
    reason: heuristicReason(item, categoryLabel, examples)
  };
}

function sanitizeInputItem(value: unknown): SmsUnderstandingInput | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const typed = value as Record<string, unknown>;
  const direction = typed.direction === 'credit' ? 'credit' : typed.direction === 'debit' ? 'debit' : null;
  const merchant = optionalString(typed.merchant);
  const providerTransactionId = optionalString(typed.providerTransactionId);
  const rawBody = optionalString(typed.rawBody);
  const sender = optionalString(typed.sender);
  const amount = typeof typed.amount === 'number' ? typed.amount : Number.parseFloat(String(typed.amount ?? ''));

  if (!direction || !merchant || !providerTransactionId || !rawBody || !sender) {
    return null;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return {
    accountMask: optionalString(typed.accountMask),
    amount,
    bankName: optionalString(typed.bankName),
    bookedAt: optionalString(typed.bookedAt),
    direction,
    merchant,
    providerTransactionId,
    rawBody,
    sender
  };
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
    userId: data.user.id
  };
}

async function loadRecentExamples(db: SupabaseClient, userId: string) {
  const { data, error } = await db
    .from('transactions')
    .select('merchant_name, direction, manual, metadata')
    .eq('user_id', userId)
    .order('booked_at', { ascending: false })
    .limit(60);

  if (error) {
    throw error;
  }

  const seen = new Set<string>();

  return ((data as TransactionsExampleRow[] | null) ?? [])
    .map((row) => {
      const metadata = row.metadata ?? {};
      const categoryLabel = optionalString(metadata.category_label);
      const merchant = optionalString(row.merchant_name);
      const txRawBody = optionalString(metadata.tx_raw_body);
      const source = optionalString(metadata.source) ?? 'unknown';
      const seeded = Boolean(metadata.seeded);

      if (!categoryLabel || !merchant || seeded) {
        return null;
      }

      const key = `${normalizeText(merchant)}::${normalizeText(categoryLabel)}`;

      if (seen.has(key)) {
        return null;
      }

      seen.add(key);

      return {
        categoryLabel: normalizeCategoryLabel(categoryLabel, row.direction === 'credit' ? 'credit' : 'debit'),
        direction: optionalString(row.direction) ?? 'debit',
        manual: Boolean(row.manual),
        merchant,
        source,
        txRawBody: txRawBody ?? undefined
      } satisfies TrainingExample;
    })
    .filter((item): item is TrainingExample => Boolean(item))
    .slice(0, 24);
}

function buildPrompt(items: SmsUnderstandingInput[], examples: TrainingExample[]) {
  const systemPrompt = `You are Astra SMS Intelligence Agent.

You classify official bank debit and credit SMS for an Indian personal finance app.

Rules:
- Return exactly one result for each input item.
- Keep providerTransactionId unchanged.
- Choose categoryLabel only from the provided enum.
- Credit events should almost always be Income.
- Prefer the user's recent labeled examples over generic rules.
- Normalize merchants into short display-ready names like "Spotify", "Uber", "Blinkit", "Canara Bank".
- Normalize bank names into canonical Indian bank names when obvious.
- Mark isRecurring true for subscriptions, rent, EMI, bills, insurance, SIPs, or clearly periodic payments.
- Keep the reason short and specific.
- If uncertain, keep confidence low and still provide the best safe answer.

Food nuance:
- Blinkit, Zepto, Instamart -> Groceries
- Swiggy, Zomato, Coconut, Tiffin -> Food & Drink unless the merchant is clearly a restaurant
- Taco Bell, pizza chains, dine-in brands -> Restaurant
- Chaayos, Starbucks, cafes -> Coffee

Transport nuance:
- Uber, Ola, Rapido, fuel, metro, cabs -> Car & Transport
- Flights, hotels, Airbnb, vacations -> Travel & Vacation`;

  const userPrompt = JSON.stringify(
    {
      categoryEnum: canonicalCategories,
      inputItems: items.map((item) => ({
        accountMask: item.accountMask ?? null,
        amount: item.amount,
        bankName: item.bankName ?? null,
        bookedAt: item.bookedAt ?? null,
        direction: item.direction,
        merchant: item.merchant,
        providerTransactionId: item.providerTransactionId,
        rawBody: item.rawBody,
        sender: item.sender
      })),
      recentUserExamples: examples.map((example) => ({
        categoryLabel: example.categoryLabel,
        direction: example.direction,
        manual: example.manual,
        merchant: example.merchant,
        source: example.source,
        txRawBody: example.txRawBody ?? null
      }))
    },
    null,
    2
  );

  return {
    systemPrompt,
    userPrompt
  };
}

async function runOpenAiUnderstanding(
  items: SmsUnderstandingInput[],
  examples: TrainingExample[]
): Promise<{
  model: string;
  results: HeuristicResult[];
  usedFallback: boolean;
}> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')?.trim();

  if (!apiKey) {
    return {
      model: fallbackModelVersion,
      results: items.map((item) => heuristicResult(item, examples)),
      usedFallback: true
    };
  }

  const openai = new OpenAI({
    apiKey
  });
  const { systemPrompt, userPrompt } = buildPrompt(items, examples);

  try {
    const result = await openai.responses.create({
      model: defaultOpenAiModel,
      input: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      max_output_tokens: 2600,
      text: {
        format: {
          name: 'sms_understanding_batch',
          schema: responseSchema,
          strict: true,
          type: 'json_schema'
        }
      }
    });
    const outputText = result.output_text?.trim();

    if (!outputText) {
      throw new Error('OpenAI returned no structured output.');
    }

    const parsed = JSON.parse(outputText) as { results?: OpenAiStructuredResult[] };
    const rawResults = Array.isArray(parsed.results) ? parsed.results : [];
    const resultsById = new Map(rawResults.map((entry) => [entry.providerTransactionId, entry] as const));
    let usedFallback = rawResults.length !== items.length;
    const normalizedResults = items.map((item) => {
      const raw = resultsById.get(item.providerTransactionId);

      if (!raw) {
        usedFallback = true;
        return heuristicResult(item, examples);
      }

      const fallback = heuristicResult(item, examples);
      const normalizedMerchant = optionalString(raw.normalizedMerchant);
      const normalizedBankName = optionalString(raw.normalizedBankName);
      const normalizedReason = optionalString(raw.reason);

      return {
        categoryLabel: normalizeCategoryLabel(raw.categoryLabel, item.direction),
        confidence:
          typeof raw.confidence === 'number' && Number.isFinite(raw.confidence)
            ? clamp(raw.confidence, 0, 1)
            : fallback.confidence,
        isRecurring: typeof raw.isRecurring === 'boolean' ? raw.isRecurring : fallback.isRecurring,
        normalizedBankName: normalizeBankName(normalizedBankName ?? item.bankName, item.rawBody) ?? fallback.normalizedBankName,
        normalizedMerchant: normalizedMerchant ? smartMerchantName(normalizedMerchant) : fallback.normalizedMerchant,
        providerTransactionId: item.providerTransactionId,
        reason: normalizedReason ?? fallback.reason
      } satisfies HeuristicResult;
    });

    return {
      model: defaultOpenAiModel,
      results: normalizedResults,
      usedFallback
    };
  } catch (error) {
    console.error('[sms-understanding] OpenAI request failed, using fallback.', error);

    return {
      model: fallbackModelVersion,
      results: items.map((item) => heuristicResult(item, examples)),
      usedFallback: true
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  if (req.method !== 'POST') {
    return failure(405, 'Method not allowed.');
  }

  try {
    const ctx = await authContext(req);
    const body = (await req.json()) as Record<string, unknown>;
    const action = optionalString(body.action);

    if (action !== 'understand_sms_batch') {
      return failure(400, 'Unsupported action.');
    }

    const rawItems = Array.isArray(body.items) ? body.items : [];
    const items = rawItems
      .map((item) => sanitizeInputItem(item))
      .filter((item): item is SmsUnderstandingInput => Boolean(item))
      .slice(0, 25);

    if (!items.length) {
      return failure(400, 'No valid SMS items were provided.');
    }

    const examples = await loadRecentExamples(ctx.db, ctx.userId);
    const understanding = await runOpenAiUnderstanding(items, examples);

    return success({
      model: understanding.model,
      promptVersion,
      results: understanding.results,
      usedFallback: understanding.usedFallback
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown sms understanding error.';
    const statusCode = message === 'Unauthorized' ? 401 : 500;
    return failure(statusCode, message);
  }
});
