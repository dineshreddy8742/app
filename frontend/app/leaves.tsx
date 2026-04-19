import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../src/auth';
import { api } from '../src/api';
import { colors, fonts, radius, spacing, softShadow } from '../src/theme';

export default function Leaves() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await api.leaves() as any[]); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const apply = async () => {
    if (!from || !to || !reason) { Alert.alert('Fill all fields'); return; }
    setSaving(true);
    try {
      await api.applyLeave({ from_date: from, to_date: to, reason });
      setFrom(''); setTo(''); setReason('');
      await load();
      Alert.alert('Submitted', 'Leave request submitted');
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  const act = async (id: string, ok: boolean) => {
    try {
      if (ok) await api.approveLeave(id); else await api.rejectLeave(id);
      await load();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Leave Requests</Text>
        <View style={{ width: 24 }} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          {user?.role !== 'admin' && (
            <View style={styles.card}>
              <Text style={styles.section}>Apply for Leave</Text>
              <Text style={styles.label}>From (YYYY-MM-DD)</Text>
              <TextInput testID="leave-from" style={styles.input} value={from} onChangeText={setFrom} placeholder="2026-05-01" placeholderTextColor={colors.textTertiary} />
              <Text style={styles.label}>To (YYYY-MM-DD)</Text>
              <TextInput testID="leave-to" style={styles.input} value={to} onChangeText={setTo} placeholder="2026-05-03" placeholderTextColor={colors.textTertiary} />
              <Text style={styles.label}>Reason</Text>
              <TextInput testID="leave-reason" style={[styles.input, { height: 80 }]} multiline value={reason} onChangeText={setReason} placeholder="Family function" placeholderTextColor={colors.textTertiary} />
              <TouchableOpacity testID="leave-submit" style={styles.submitBtn} onPress={apply} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>Submit Request</Text>}
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.section}>{user?.role === 'admin' ? 'All Requests' : 'My Requests'}</Text>
          {loading ? <ActivityIndicator color={colors.primary} /> : items.length === 0 ? (
            <Text style={styles.meta}>No requests.</Text>
          ) : items.map((l) => (
            <View key={l.id} style={styles.leaveCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.name}>{l.user_name}</Text>
                <View style={[styles.badge, statusColor(l.status)]}>
                  <Text style={styles.badgeText}>{l.status.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.meta}>{l.from_date} → {l.to_date} • {l.role}</Text>
              <Text style={styles.reason}>{l.reason}</Text>
              {user?.role === 'admin' && l.status === 'pending' && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.mint, borderColor: colors.mintBorder }]} onPress={() => act(l.id, true)} testID={`approve-${l.id}`}>
                    <Text style={styles.actionText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.coral, borderColor: colors.coralBorder }]} onPress={() => act(l.id, false)} testID={`reject-${l.id}`}>
                    <Text style={styles.actionText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function statusColor(s: string) {
  if (s === 'approved') return { backgroundColor: colors.mint, borderColor: colors.mintBorder };
  if (s === 'rejected') return { backgroundColor: colors.coral, borderColor: colors.coralBorder };
  return { backgroundColor: colors.warning, borderColor: colors.warningBorder };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.appBg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screen, paddingVertical: 12 },
  title: { fontFamily: fonts.heading, fontSize: 18, color: colors.textPrimary },
  section: { fontFamily: fonts.heading, fontSize: 16, color: colors.textPrimary, marginBottom: 12, marginTop: 8 },
  card: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderDefault, padding: 16, marginBottom: 16, ...softShadow },
  label: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textSecondary, marginTop: 10, marginBottom: 4 },
  input: { backgroundColor: colors.appBg, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: 10, padding: 12, fontFamily: fonts.bodyMed, fontSize: 14, color: colors.textPrimary },
  submitBtn: { marginTop: 14, backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', ...softShadow },
  submitText: { color: colors.white, fontFamily: fonts.headingSemi, fontSize: 15 },
  leaveCard: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderDefault, padding: 14, marginBottom: 10, ...softShadow },
  name: { fontFamily: fonts.heading, fontSize: 15, color: colors.textPrimary },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  reason: { fontFamily: fonts.bodyMed, fontSize: 13, color: colors.textPrimary, marginTop: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  badgeText: { fontFamily: fonts.bodySemi, fontSize: 10, color: colors.textPrimary },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  actionText: { fontFamily: fonts.headingSemi, fontSize: 13, color: colors.textPrimary },
});
