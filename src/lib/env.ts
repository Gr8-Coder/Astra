function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `[env] Missing ${name}. Add it to the local .env file before starting Astra.`
    );
  }

  return value;
}

function getSupabasePublicKey() {
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (publishableKey) {
    return publishableKey;
  }

  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (anonKey) {
    return anonKey;
  }

  throw new Error(
    '[env] Missing EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Use the project publishable key, not a secret key.'
  );
}

export const env = {
  supabaseUrl: requireEnv('EXPO_PUBLIC_SUPABASE_URL'),
  supabasePublishableKey: getSupabasePublicKey()
};
