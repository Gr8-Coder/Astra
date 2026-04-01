import {
  Poppins_300Light,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts
} from '@expo-google-fonts/poppins';
import { type Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { maybeHandleIncomingAuthSession } from './src/lib/auth';
import { supabase } from './src/lib/supabase';
import { AuthScreen } from './src/screens/AuthScreen';
import { AstraAppShell } from './src/screens/AstraAppShell';
import { colors, fonts } from './src/theme';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [fontsLoaded] = useFonts({
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold
  });

  useEffect(() => {
    let isMounted = true;

    async function bootstrapAuth() {
      try {
        const initialUrl = await Linking.getInitialURL();

        if (initialUrl) {
          await maybeHandleIncomingAuthSession(initialUrl);
        }

        const {
          data: { session: currentSession }
        } = await supabase.auth.getSession();

        if (isMounted) {
          setSession(currentSession);
        }
      } finally {
        if (isMounted) {
          setAuthReady(true);
        }
      }
    }

    void bootstrapAuth();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) {
        setSession(nextSession);
        setAuthReady(true);
      }
    });

    const urlSubscription = Linking.addEventListener('url', ({ url }) => {
      void maybeHandleIncomingAuthSession(url);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      urlSubscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      {!fontsLoaded || !authReady ? (
        <View style={styles.loadingScreen}>
          <Text allowFontScaling={false} style={styles.loadingLogo}>
            Astra
          </Text>
          <ActivityIndicator color={colors.accent} size="small" />
        </View>
      ) : session ? (
        <AstraAppShell />
      ) : (
        <AuthScreen />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center'
  },
  loadingLogo: {
    color: colors.textPrimary,
    fontFamily: fonts.light,
    fontSize: 34,
    letterSpacing: 0.6,
    marginBottom: 18
  }
});
