const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

function requireStaticEnv(name: string, value?: string) {
  const normalized = value?.trim();

  if (!normalized) {
    throw new Error(
      `[env] Missing ${name}. Add it to the local .env file before starting Astra.`
    );
  }

  return normalized;
}

function getSupabasePublicKey() {
  if (SUPABASE_PUBLISHABLE_KEY) {
    return SUPABASE_PUBLISHABLE_KEY;
  }

  if (SUPABASE_ANON_KEY) {
    return SUPABASE_ANON_KEY;
  }

  throw new Error(
    '[env] Missing EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Use the project publishable key, not a secret key.'
  );
}

export const env = {
  supabaseUrl: requireStaticEnv('EXPO_PUBLIC_SUPABASE_URL', SUPABASE_URL),
  supabasePublishableKey: getSupabasePublicKey()
};
