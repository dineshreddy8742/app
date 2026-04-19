import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { api } from '../src/api';
import { colors, fonts, radius, spacing, softShadow } from '../src/theme';

const AUDIENCES = ['all', 'admin', 'teacher', 'student', 'parent'];

export default function Announce() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('all');
  const [type, setType] = useState('announcement');
  const [saving, setSaving] = useState(false);

  const send = async () => {
    if (!title || !message) { Alert.alert('Fill title and message'); return; }
    setSaving(true);
    try {
      await api.createNotif({ title, message, audience, type });
      Alert.alert('Sent', 'Announcement broadcast');
      setTitle(''); setMessage('');
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>New Announcement</Text>
        <View style={{ width: 24 }} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.screen }} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Title</Text>
          <TextInput testID="announce-title" style={styles.input} value={title} onChangeText={setTitle} placeholder="Holiday Notice" placeholderTextColor={colors.textTertiary} />
          <Text style={styles.label}>Message</Text>
          <TextInput testID="announce-message" style={[styles.input, { height: 120 }]} multiline value={message} onChangeText={setMessage} placeholder="Details..." placeholderTextColor={colors.textTertiary} />
          <Text style={styles.label}>Audience</Text>
          <View style={styles.chipRow}>
            {AUDIENCES.map((a) => (
              <TouchableOpacity key={a} onPress={() => setAudience(a)} style={[styles.chip, audience === a && styles.chipActive]}>
                <Text style={[styles.chipText, audience === a && styles.chipTextActive]}>{a}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>Type</Text>
          <View style={styles.chipRow}>
            {['announcement', 'fee', 'attendance', 'general'].map((a) => (
              <TouchableOpacity key={a} onPress={() => setType(a)} style={[styles.chip, type === a && styles.chipActive]}>
                <Text style={[styles.chipText, type === a && styles.chipTextActive]}>{a}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity testID="announce-send" style={styles.btn} onPress={send} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.btnText}>Send</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.appBg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screen, paddingVertical: 12 },
  title: { fontFamily: fonts.heading, fontSize: 18, color: colors.textPrimary },
  label: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textSecondary, marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: 10, padding: 12, fontFamily: fonts.bodyMed, fontSize: 14, color: colors.textPrimary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.textPrimary },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textPrimary },
  chipTextActive: { color: colors.white },
  btn: { marginTop: 20, backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', ...softShadow },
  btnText: { color: colors.white, fontFamily: fonts.headingSemi, fontSize: 15 },
});
