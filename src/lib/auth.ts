import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export const authRedirectTo = makeRedirectUri({
  path: 'auth/callback'
});

export async function maybeHandleIncomingAuthSession(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);

  if (errorCode) {
    throw new Error(errorCode);
  }

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;

  if (!accessToken || !refreshToken) {
    return null;
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });

  if (error) {
    throw error;
  }

  return data.session;
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: authRedirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        prompt: 'select_account'
      }
    }
  });

  if (error) {
    throw error;
  }

  if (!data?.url) {
    throw new Error('Google sign-in URL could not be created.');
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, authRedirectTo);

  if (result.type === 'success') {
    return maybeHandleIncomingAuthSession(result.url);
  }

  if (result.type === 'cancel' || result.type === 'dismiss') {
    return null;
  }

  throw new Error('Google sign-in did not complete.');
}
