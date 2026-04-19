import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../src/auth';
import { colors, fonts, radius, spacing, brutalShadow, softShadow } from '../src/theme';

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@school.com', password: 'admin123', color: colors.primaryLight, border: colors.primary },
  { role: 'Teacher', email: 'teacher@school.com', password: 'teacher123', color: colors.mint, border: colors.mintBorder },
  { role: 'Student', email: 'student@school.com', password: 'student123', color: colors.peach, border: colors.peachBorder },
  { role: 'Parent', email: 'parent@school.com', password: 'parent123', color: colors.lavender, border: colors.lavenderBorder },
];

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const submit = async (e?: string, p?: string) => {
    const em = e ?? email;
    const pw = p ?? password;
    if (!em || !pw) {
      Alert.alert('Missing fields', 'Please enter email and password');
      return;
    }
    setBusy(true);
    try {
      await login(em, pw);
    } catch (err: any) {
      Alert.alert('Login failed', err.message || 'Please try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.logoWrap}>
            <View style={styles.logoBox} testID="brand-logo">
              <Feather name="book-open" size={28} color={colors.white} />
            </View>
            <Text style={styles.brandName}>Scholara</Text>
          </View>

          <Text style={styles.hello}>Welcome back 👋</Text>
          <Text style={styles.sub}>Sign in to manage your school day</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrap}>
              <Feather name="mail" size={18} color={colors.textSecondary} />
              <TextInput
                testID="login-email-input"
                style={styles.input}
                placeholder="you@school.com or roll no"
                placeholderTextColor={colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
            </View>

            <Text style={[styles.label, { marginTop: spacing.md }]}>Password</Text>
            <View style={styles.inputWrap}>
              <Feather name="lock" size={18} color={colors.textSecondary} />
              <TextInput
                testID="login-password-input"
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
              />
              <TouchableOpacity onPress={() => setShowPass((s) => !s)}>
                <Feather name={showPass ? 'eye-off' : 'eye'} size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              testID="login-form-submit-button"
              style={[styles.primaryBtn, busy && { opacity: 0.7 }]}
              onPress={() => submit()}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryBtnText}>Sign in</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.demoTitle}>Try a demo account</Text>
          <View style={styles.demoGrid}>
            {DEMO_ACCOUNTS.map((a) => (
              <TouchableOpacity
                key={a.role}
                testID={`demo-login-${a.role.toLowerCase()}`}
                style={[styles.demoCard, { backgroundColor: a.color, borderColor: a.border }]}
                onPress={() => {
                  setEmail(a.email);
                  setPassword(a.password);
                  submit(a.email, a.password);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.demoRole}>{a.role}</Text>
                <Text style={styles.demoEmail}>{a.email}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.appBg },
  container: { padding: spacing.screen, paddingBottom: spacing.xl },
  logoWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  logoBox: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: colors.textPrimary,
    justifyContent: 'center', alignItems: 'center',
  },
  brandName: { fontFamily: fonts.headingExtra, fontSize: 22, color: colors.textPrimary, letterSpacing: -0.5 },
  hello: { fontFamily: fonts.heading, fontSize: 32, color: colors.textPrimary, marginTop: 28 },
  sub: { fontFamily: fonts.body, fontSize: 16, color: colors.textSecondary, marginTop: 4 },
  card: {
    marginTop: 24,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    padding: spacing.lg,
    ...brutalShadow,
  },
  label: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textSecondary, marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.appBg,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  input: { flex: 1, fontFamily: fonts.bodyMed, fontSize: 15, color: colors.textPrimary },
  primaryBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.md,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    ...softShadow,
  },
  primaryBtnText: { color: colors.white, fontFamily: fonts.headingSemi, fontSize: 16 },
  demoTitle: {
    marginTop: spacing.xl, fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  demoGrid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  demoCard: {
    width: '48%', borderRadius: radius.md, borderWidth: 1, padding: 14,
    ...softShadow,
  },
  demoRole: { fontFamily: fonts.heading, fontSize: 16, color: colors.textPrimary },
  demoEmail: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
