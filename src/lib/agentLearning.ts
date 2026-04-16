import AsyncStorage from '@react-native-async-storage/async-storage';

import { transactionCategoryOptions } from '../data/transactions';
import { supabase } from './supabase';

type AgentDirection = 'credit' | 'debit' | 'transfer';

type AgentTrainingExample = {
  categoryLabel: string;
  direction: AgentDirection;
  message?: string;
  merchant: string;
};

type AgentProfile = {
  categoryTokenWeights: Record<string, Record<string, number>>;
  fineTunedSampleCount: number;
  lastTrainedAt: string;
  merchantCategoryWeights: Record<string, Record<string, number>>;
  modelVersion: string;
  promptVersion: string;
  sampleCount: number;
};

type ManualTransactionSeedRow = {
  direction: AgentDirection | null;
  merchant_name: string;
  metadata: Record<string, unknown> | null;
};

type PredictionInput = {
  direction: AgentDirection;
  explicitCategoryLabel?: string;
  fallbackCategoryLabel: string;
  merchant: string;
  rawBody?: string;
  userId: string;
};

type FeedbackInput = {
  categoryLabel: string;
  merchant: string;
  rawBody?: string;
  source: 'manual' | 'recurring' | 'transaction-edit';
  userId: string;
};

export type AgentCategoryPrediction = {
  categoryLabel: string;
  confidence: number;
  modelVersion: string;
  promptVersion: string;
  reason: string;
  usedFallback: boolean;
};

export type AgentProfileStats = {
  fineTunedSampleCount: number;
  lastTrainedAt: string;
  modelVersion: string;
  promptVersion: string;
  sampleCount: number;
};

const agentProfileKeyPrefix = 'astra.agent.profile';
const agentModelVersion = 'astra-local-intelligence-v1';
const agentPromptVersion = 'astra-prompt-v1';
const minimumConfidenceForDirectUse = 0.52;
const minimumScoreForDirectUse = 1.25;
const canonicalCategories = [
  ...new Set([...transactionCategoryOptions.map((item) => item.label), 'Income', 'Other'])
];
const categoryAliasMap: Record<string, string> = {
  'car & transport': 'Car & Transport',
  'car and transport': 'Car & Transport',
  clothes: 'Clothing',
  clothing: 'Clothing',
  coffee: 'Coffee',
  entertainment: 'Entertainment',
  groceries: 'Groceries',
  health: 'Healthcare',
  healthcare: 'Healthcare',
  income: 'Income',
  other: 'Other',
  rent: 'Rent',
  restaurant: 'Restaurant',
  restaurants: 'Restaurant',
  shopping: 'Shopping',
  shops: 'Shop',
  shop: 'Shop',
  streaming: 'Streaming',
  transport: 'Car & Transport',
  travel: 'Travel',
  'travel & vacation': 'Travel & Vacation',
  utilities: 'Utilities',
  'food & drink': 'Food & Drink',
  'food and drink': 'Food & Drink'
};
const stopWords = new Set([
  'a',
  'ac',
  'account',
  'amt',
  'at',
  'avl',
  'bal',
  'balance',
  'bank',
  'by',
  'for',
  'from',
  'inr',
  'is',
  'on',
  'payment',
  'ref',
  'rs',
  'to',
  'txn',
  'upi',
  'utr',
  'via',
  'you',
  'your'
]);

export const ASTRA_AGENT_SYSTEM_PROMPT_V1 = `You are Astra Transaction Intelligence Agent.

Goal:
1. Classify each money event into the best category.
2. Keep category assignment stable and explainable.
3. Prioritize user corrections over prior guesses.

Rules:
- Credit events map to Income unless user explicitly chooses another category.
- Debit events map to one expense category.
- Prefer merchant intent over sender token noise.
- Use Indian payment context (UPI, rent, tiffin, subscriptions, fuel, cafes, pharmacies).
- Keep confidence low when uncertain and fall back to safe baseline classification.

Important mapping examples:
- Spotify / Netflix / Prime / Hotstar -> Streaming
- Coconut / Tiffin / Swiggy / Zomato -> Food & Drink
- Blinkit / Zepto / Instamart -> Groceries
- Uber / Ola / Rapido / Metro / Fuel -> Car & Transport or Travel
- Apollo / Pharmacy / Medical -> Healthcare
- Electricity / Internet / Broadband / Gas -> Utilities
- Rent / Lease / Landlord -> Rent

Learning loop:
- Every user edit is ground truth.
- Increase weight for corrected merchant + text tokens.
- Keep latest behavior dominant for future predictions.`;

const starterExamples: AgentTrainingExample[] = [
  { categoryLabel: 'Streaming', direction: 'debit', merchant: 'Spotify', message: 'UPI debit to Spotify INR 179' },
  { categoryLabel: 'Streaming', direction: 'debit', merchant: 'Netflix', message: 'Card debit Netflix Rs 199' },
  { categoryLabel: 'Streaming', direction: 'debit', merchant: 'Prime Video', message: 'Subscription charged Prime Video' },
  { categoryLabel: 'Food & Drink', direction: 'debit', merchant: 'Coconut', message: 'UPI paid to Coconut Water' },
  { categoryLabel: 'Food & Drink', direction: 'debit', merchant: 'Tiffin', message: 'Sent INR 2500 for Tiffin service' },
  { categoryLabel: 'Food & Drink', direction: 'debit', merchant: 'Swiggy', message: 'UPI payment to Swiggy order' },
  { categoryLabel: 'Groceries', direction: 'debit', merchant: 'Blinkit', message: 'Paid via UPI to Blinkit groceries' },
  { categoryLabel: 'Groceries', direction: 'debit', merchant: 'Zepto', message: 'Spent on Zepto instant groceries' },
  { categoryLabel: 'Restaurant', direction: 'debit', merchant: 'Taco Bell', message: 'Card payment at Taco Bell' },
  { categoryLabel: 'Coffee', direction: 'debit', merchant: 'Chaayos', message: 'Paid at Chaayos cafe' },
  { categoryLabel: 'Rent', direction: 'debit', merchant: 'Rent', message: 'Transferred rent amount to landlord' },
  { categoryLabel: 'Car & Transport', direction: 'debit', merchant: 'Uber', message: 'UPI paid to Uber trip' },
  { categoryLabel: 'Car & Transport', direction: 'debit', merchant: 'OLA', message: 'Debited for Ola ride' },
  { categoryLabel: 'Travel & Vacation', direction: 'debit', merchant: 'Airbnb', message: 'Airbnb booking charge' },
  { categoryLabel: 'Healthcare', direction: 'debit', merchant: 'Apollo Medical', message: 'Card charged at Apollo Pharmacy' },
  { categoryLabel: 'Utilities', direction: 'debit', merchant: 'Airtel Broadband', message: 'Bill payment broadband' },
  { categoryLabel: 'Entertainment', direction: 'debit', merchant: 'BookMyShow', message: 'Movie booking payment' },
  { categoryLabel: 'Clothing', direction: 'debit', merchant: 'H&M', message: 'Card payment at H&M' },
  { categoryLabel: 'Shop', direction: 'debit', merchant: 'Crosswords', message: 'Purchase at Crosswords store' },
  { categoryLabel: 'Income', direction: 'credit', merchant: 'Salary Credit', message: 'Salary credited to account' }
];

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function normalizeCategoryLabel(label: string) {
  const normalized = normalizeText(label);
  const alias = categoryAliasMap[normalized];

  if (alias) {
    return alias;
  }

  const exact = canonicalCategories.find((item) => normalizeText(item) === normalized);
  return exact ?? 'Other';
}

function profileStorageKey(userId: string) {
  return `${agentProfileKeyPrefix}.${userId}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function tokenize(text: string) {
  const normalized = normalizeText(text)
    .replace(/[₹.,:/\\()\-_*#]/g, ' ')
    .replace(/\s+/g, ' ');

  return normalized
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !stopWords.has(token));
}

function merchantKey(merchant: string) {
  return normalizeText(merchant).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function emptyProfile(): AgentProfile {
  return {
    categoryTokenWeights: {},
    fineTunedSampleCount: 0,
    lastTrainedAt: new Date().toISOString(),
    merchantCategoryWeights: {},
    modelVersion: agentModelVersion,
    promptVersion: agentPromptVersion,
    sampleCount: 0
  };
}

function trainProfileWithExample(profile: AgentProfile, example: AgentTrainingExample, weight = 1) {
  const categoryLabel = normalizeCategoryLabel(example.categoryLabel);
  const merchant = merchantKey(example.merchant);
  const tokens = tokenize([example.merchant, example.message ?? ''].join(' '));

  if (!profile.categoryTokenWeights[categoryLabel]) {
    profile.categoryTokenWeights[categoryLabel] = {};
  }

  tokens.forEach((token) => {
    const current = profile.categoryTokenWeights[categoryLabel]?.[token] ?? 0;
    profile.categoryTokenWeights[categoryLabel][token] = current + weight;
  });

  if (merchant) {
    if (!profile.merchantCategoryWeights[merchant]) {
      profile.merchantCategoryWeights[merchant] = {};
    }

    const current = profile.merchantCategoryWeights[merchant]?.[categoryLabel] ?? 0;
    profile.merchantCategoryWeights[merchant][categoryLabel] = current + weight * 2.2;
  }

  profile.sampleCount += 1;
  profile.lastTrainedAt = new Date().toISOString();
}

function scoreCategories(profile: AgentProfile, merchant: string, rawBody?: string) {
  const scores: Record<string, number> = {};
  const key = merchantKey(merchant);
  const tokens = tokenize([merchant, rawBody ?? ''].join(' '));

  tokens.forEach((token) => {
    Object.entries(profile.categoryTokenWeights).forEach(([categoryLabel, weights]) => {
      const weight = weights[token] ?? 0;

      if (weight > 0) {
        scores[categoryLabel] = (scores[categoryLabel] ?? 0) + weight;
      }
    });
  });

  const merchantWeights = profile.merchantCategoryWeights[key] ?? {};

  Object.entries(merchantWeights).forEach(([categoryLabel, weight]) => {
    scores[categoryLabel] = (scores[categoryLabel] ?? 0) + weight;
  });

  return scores;
}

function estimateConfidence(topScore: number, secondScore: number) {
  const ratio = topScore / (topScore + secondScore + 1);
  return clamp(ratio, 0.35, 0.99);
}

async function readProfile(userId: string) {
  const raw = await AsyncStorage.getItem(profileStorageKey(userId));

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as AgentProfile;

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn('[agent] failed to parse profile', error);
    return null;
  }
}

async function writeProfile(userId: string, profile: AgentProfile) {
  await AsyncStorage.setItem(profileStorageKey(userId), JSON.stringify(profile));
}

async function bootstrapProfile(userId: string) {
  const existing = await readProfile(userId);

  if (existing) {
    return existing;
  }

  const profile = emptyProfile();
  starterExamples.forEach((example) => {
    trainProfileWithExample(profile, example, 1.1);
  });

  await writeProfile(userId, profile);
  return profile;
}

async function readManualTransactionExamples(userId: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('merchant_name, metadata, direction')
    .eq('user_id', userId)
    .eq('manual', true)
    .order('booked_at', { ascending: false })
    .limit(180);

  if (error) {
    throw error;
  }

  const rows = (data as ManualTransactionSeedRow[] | null) ?? [];

  const examples: AgentTrainingExample[] = [];

  rows.forEach((row) => {
    const metadata = row.metadata ?? {};
    const storedCategory = metadata.category_label;
    const categoryLabel = typeof storedCategory === 'string' ? normalizeCategoryLabel(storedCategory) : '';

    if (!categoryLabel) {
      return;
    }

    examples.push({
      categoryLabel,
      direction: row.direction ?? 'debit',
      message: typeof metadata.tx_raw_body === 'string' ? metadata.tx_raw_body : undefined,
      merchant: row.merchant_name
    });
  });

  return examples;
}

export async function ensureAstraAgentReady(userId: string) {
  const profile = await bootstrapProfile(userId);

  if (profile.fineTunedSampleCount > 0) {
    return;
  }

  try {
    const manualExamples = await readManualTransactionExamples(userId);

    if (!manualExamples.length) {
      return;
    }

    manualExamples.forEach((example) => {
      trainProfileWithExample(profile, example, 1.6);
      profile.fineTunedSampleCount += 1;
    });

    await writeProfile(userId, profile);
  } catch (error) {
    console.warn('[agent] failed to pre-seed from manual examples', error);
  }
}

export async function loadAstraAgentProfileStats(userId: string): Promise<AgentProfileStats> {
  const profile = (await readProfile(userId)) ?? (await bootstrapProfile(userId));

  return {
    fineTunedSampleCount: profile.fineTunedSampleCount,
    lastTrainedAt: profile.lastTrainedAt,
    modelVersion: profile.modelVersion,
    promptVersion: profile.promptVersion,
    sampleCount: profile.sampleCount
  };
}

export async function predictCategoryWithAstraAgent(
  input: PredictionInput
): Promise<AgentCategoryPrediction> {
  const fallbackCategoryLabel = normalizeCategoryLabel(input.fallbackCategoryLabel);

  if (input.direction === 'credit') {
    return {
      categoryLabel: 'Income',
      confidence: 0.99,
      modelVersion: agentModelVersion,
      promptVersion: agentPromptVersion,
      reason: 'credit-event',
      usedFallback: false
    };
  }

  if (input.explicitCategoryLabel?.trim()) {
    return {
      categoryLabel: normalizeCategoryLabel(input.explicitCategoryLabel),
      confidence: 0.98,
      modelVersion: agentModelVersion,
      promptVersion: agentPromptVersion,
      reason: 'explicit-category',
      usedFallback: false
    };
  }

  const profile = (await readProfile(input.userId)) ?? (await bootstrapProfile(input.userId));
  const scores = scoreCategories(profile, input.merchant, input.rawBody);
  const sorted = Object.entries(scores).sort((left, right) => right[1] - left[1]);
  const top = sorted[0];
  const second = sorted[1];

  if (!top) {
    return {
      categoryLabel: fallbackCategoryLabel,
      confidence: 0.4,
      modelVersion: profile.modelVersion,
      promptVersion: profile.promptVersion,
      reason: 'no-score-fallback',
      usedFallback: true
    };
  }

  const topCategory = normalizeCategoryLabel(top[0]);
  const topScore = top[1];
  const secondScore = second?.[1] ?? 0;
  const confidence = estimateConfidence(topScore, secondScore);

  if (topScore < minimumScoreForDirectUse || confidence < minimumConfidenceForDirectUse) {
    return {
      categoryLabel: fallbackCategoryLabel,
      confidence,
      modelVersion: profile.modelVersion,
      promptVersion: profile.promptVersion,
      reason: 'low-confidence-fallback',
      usedFallback: true
    };
  }

  return {
    categoryLabel: topCategory,
    confidence,
    modelVersion: profile.modelVersion,
    promptVersion: profile.promptVersion,
    reason: 'profile-scoring',
    usedFallback: false
  };
}

export async function learnFromUserCategoryFeedback(input: FeedbackInput) {
  const profile = (await readProfile(input.userId)) ?? (await bootstrapProfile(input.userId));

  trainProfileWithExample(
    profile,
    {
      categoryLabel: input.categoryLabel,
      direction: 'debit',
      message: [input.rawBody, input.source].filter(Boolean).join(' '),
      merchant: input.merchant
    },
    2.8
  );
  profile.fineTunedSampleCount += 1;
  profile.lastTrainedAt = new Date().toISOString();

  await writeProfile(input.userId, profile);
}
