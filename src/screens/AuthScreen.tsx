import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { authRedirectTo, signInWithGoogle } from '../lib/auth';
import { hapticSelection, hapticSoft, hapticWarning } from '../lib/haptics';
import { supabase } from '../lib/supabase';
import { clamp, colors, fonts, radii } from '../theme';

type Mode = 'sign-in' | 'sign-up';

export function AuthScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const horizontalPadding = clamp(width * 0.06, 20, 28);
  const isCompact = width < 390;

  const helperText = useMemo(() => {
    if (mode === 'sign-in') {
      return 'Sign in to sync accounts, track categories, and make Astra personal.';
    }

    return 'Create your Astra account and we will set up your profile automatically.';
  }, [mode]);

  async function handleEmailAuth() {
    if (!email.trim() || !password.trim()) {
      hapticWarning();
      Alert.alert('Missing details', 'Enter both email and password to continue.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'sign-in') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });

        if (error) {
          throw error;
        }

        return;
      }

      const {
        data: { session },
        error
      } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: authRedirectTo,
          data: {
            full_name: fullName.trim() || undefined
          }
        }
      });

      if (error) {
        throw error;
      }

      if (!session) {
        hapticSoft();
        Alert.alert(
          'Check your inbox',
          'Supabase created the account. Approve the email verification link, then sign in.'
        );
      }
    } catch (error) {
      hapticWarning();
      const message = error instanceof Error ? error.message : 'Something went wrong.';
      Alert.alert('Authentication error', message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleAuth() {
    hapticSoft();
    setLoading(true);

    try {
      await signInWithGoogle();
    } catch (error) {
      hapticWarning();
      const message = error instanceof Error ? error.message : 'Something went wrong.';
      Alert.alert('Google sign-in error', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom: Math.max(insets.bottom, 20) + 24,
              paddingHorizontal: horizontalPadding
            }
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.brandOrb}>
              <Ionicons color={colors.accentSoft} name="sparkles" size={20} />
            </View>
            <Text allowFontScaling={false} style={styles.logo}>
              Astra
            </Text>
            <Text allowFontScaling={false} style={[styles.subtitle, isCompact ? styles.subtitleCompact : null]}>
              AI-first money clarity for your everyday accounts, budgets, recurring payments, and investments.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.modeRail}>
              <Pressable
                onPress={() => {
                  hapticSelection();
                  setMode('sign-in');
                }}
                style={[styles.modeButton, mode === 'sign-in' ? styles.modeButtonActive : null]}
              >
                <Text
                  allowFontScaling={false}
                  style={[styles.modeLabel, mode === 'sign-in' ? styles.modeLabelActive : null]}
                >
                  Sign in
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  hapticSelection();
                  setMode('sign-up');
                }}
                style={[styles.modeButton, mode === 'sign-up' ? styles.modeButtonActive : null]}
              >
                <Text
                  allowFontScaling={false}
                  style={[styles.modeLabel, mode === 'sign-up' ? styles.modeLabelActive : null]}
                >
                  Create account
                </Text>
              </Pressable>
            </View>

            <Text allowFontScaling={false} style={styles.helper}>
              {helperText}
            </Text>

            {mode === 'sign-up' ? (
              <View style={styles.fieldBlock}>
                <Text allowFontScaling={false} style={styles.fieldLabel}>
                  Full name
                </Text>
                <TextInput
                  allowFontScaling={false}
                  autoCapitalize="words"
                  onChangeText={setFullName}
                  placeholder="Sajal Tyagi"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  value={fullName}
                />
              </View>
            ) : null}

            <View style={styles.fieldBlock}>
              <Text allowFontScaling={false} style={styles.fieldLabel}>
                Email
              </Text>
              <TextInput
                allowFontScaling={false}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={email}
              />
            </View>

            <View style={styles.fieldBlock}>
              <Text allowFontScaling={false} style={styles.fieldLabel}>
                Password
              </Text>
              <TextInput
                allowFontScaling={false}
                autoCapitalize="none"
                autoComplete="password"
                onChangeText={setPassword}
                placeholder="At least 6 characters"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                style={styles.input}
                value={password}
              />
            </View>

            <Pressable
              disabled={loading}
              onPress={handleEmailAuth}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed ? styles.buttonPressed : null,
                loading ? styles.buttonDisabled : null
              ]}
            >
              <Text allowFontScaling={false} style={styles.primaryButtonText}>
                {mode === 'sign-in' ? 'Continue with email' : 'Create Astra account'}
              </Text>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text allowFontScaling={false} style={styles.dividerText}>
                or
              </Text>
              <View style={styles.divider} />
            </View>

            <Pressable
              disabled={loading}
              onPress={handleGoogleAuth}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed ? styles.buttonPressed : null,
                loading ? styles.buttonDisabled : null
              ]}
            >
              <Ionicons color={colors.textPrimary} name="logo-google" size={18} />
              <Text allowFontScaling={false} style={styles.secondaryButtonText}>
                Continue with Google
              </Text>
            </Pressable>

            <Text allowFontScaling={false} style={styles.note}>
              Google OAuth will start working after the Google provider is enabled in Supabase and the redirect URL is allow-listed.
            </Text>
          </View>

          <View style={styles.footerCard}>
            <View style={styles.footerHeader}>
              <Ionicons color={colors.accentSoft} name="link-outline" size={14} />
              <Text allowFontScaling={false} style={styles.footerTitle}>
                Current redirect URL
              </Text>
            </View>
            <Text allowFontScaling={false} selectable style={styles.redirectText}>
              {authRedirectTo}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1
  },
  flex: {
    flex: 1
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 14
  },
  header: {
    marginBottom: 26
  },
  brandOrb: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.accentMuted,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    height: 42,
    justifyContent: 'center',
    marginBottom: 16,
    width: 42
  },
  logo: {
    color: colors.textPrimary,
    fontFamily: fonts.light,
    fontSize: 37,
    letterSpacing: 0.6,
    textAlign: 'center'
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 14.4,
    lineHeight: 22,
    marginTop: 12,
    textAlign: 'center'
  },
  subtitleCompact: {
    fontSize: 13.6,
    lineHeight: 21
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: 28,
    borderWidth: 1,
    padding: 18
  },
  modeRail: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    flexDirection: 'row',
    marginBottom: 18,
    padding: 4
  },
  modeButton: {
    alignItems: 'center',
    borderRadius: radii.pill,
    flex: 1,
    paddingVertical: 11
  },
  modeButtonActive: {
    backgroundColor: colors.accent
  },
  modeLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 13
  },
  modeLabelActive: {
    color: colors.background
  },
  helper: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13.5,
    lineHeight: 20,
    marginBottom: 16
  },
  fieldBlock: {
    marginBottom: 14
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 12.5,
    marginBottom: 8
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderSoft,
    borderRadius: 18,
    borderWidth: 1,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 14,
    minHeight: 54,
    paddingHorizontal: 16
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 20,
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 56,
    paddingHorizontal: 18
  },
  primaryButtonText: {
    color: colors.background,
    fontFamily: fonts.semiBold,
    fontSize: 14.2
  },
  dividerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginVertical: 18
  },
  divider: {
    backgroundColor: colors.divider,
    flex: 1,
    height: 1
  },
  dividerText: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
    marginHorizontal: 10
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.surfacePanel,
    borderColor: colors.borderSoft,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 18
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 13.8,
    marginLeft: 10
  },
  note: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 11.6,
    lineHeight: 18,
    marginTop: 14
  },
  footerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: colors.borderSoft,
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 16,
    padding: 16
  },
  footerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 10
  },
  footerTitle: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 12.2,
    marginLeft: 7
  },
  redirectText: {
    color: colors.accentSoft,
    fontFamily: fonts.regular,
    fontSize: 12.2,
    lineHeight: 19
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.995 }]
  },
  buttonDisabled: {
    opacity: 0.62
  }
});
