import {
  AppState,
  NativeModules,
  Platform,
  TurboModuleRegistry,
  type AppStateStatus,
  type NativeEventSubscription
} from 'react-native';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';

import { env } from './env';

declare global {
  var __astraSupabaseClient__: SupabaseClient | undefined;
  var __astraSupabaseAppStateSubscription__: NativeEventSubscription | undefined;
  var __astraSupabaseStorageMode__: 'memory' | 'native' | undefined;
}

const memoryStore = new Map<string, string>();

const memoryStorage = {
  getItem(key: string) {
    return Promise.resolve(memoryStore.get(key) ?? null);
  },
  setItem(key: string, value: string) {
    memoryStore.set(key, value);
    return Promise.resolve();
  },
  removeItem(key: string) {
    memoryStore.delete(key);
    return Promise.resolve();
  }
};

function hasNativeAsyncStorage() {
  if (Platform.OS === 'web') {
    return false;
  }

  const legacyModule =
    (NativeModules as Record<string, unknown>).RNCAsyncStorage ??
    (NativeModules as Record<string, unknown>).RNAsyncStorage ??
    (NativeModules as Record<string, unknown>).AsyncSQLiteDBStorage;

  const turboModule = TurboModuleRegistry.get?.('RNAsyncStorage');

  return Boolean(legacyModule || turboModule);
}

const authStorage = hasNativeAsyncStorage() ? AsyncStorage : memoryStorage;
const storageMode = hasNativeAsyncStorage() ? 'native' : 'memory';

function createSupabaseClient() {
  return createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: {
      ...(Platform.OS !== 'web' ? { storage: authStorage } : {}),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock
    }
  });
}

if (
  globalThis.__astraSupabaseClient__ &&
  globalThis.__astraSupabaseStorageMode__ &&
  globalThis.__astraSupabaseStorageMode__ !== storageMode
) {
  globalThis.__astraSupabaseAppStateSubscription__?.remove();
  globalThis.__astraSupabaseAppStateSubscription__ = undefined;
  globalThis.__astraSupabaseClient__ = undefined;
}

export const supabase = globalThis.__astraSupabaseClient__ ?? createSupabaseClient();

if (!globalThis.__astraSupabaseClient__) {
  globalThis.__astraSupabaseClient__ = supabase;
  globalThis.__astraSupabaseStorageMode__ = storageMode;
}

if (Platform.OS !== 'web' && !globalThis.__astraSupabaseAppStateSubscription__) {
  globalThis.__astraSupabaseAppStateSubscription__ = AppState.addEventListener(
    'change',
    (state: AppStateStatus) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
        return;
      }

      supabase.auth.stopAutoRefresh();
    }
  );
}
