import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { api } from '../src/api';
import { colors, fonts, radius, spacing, softShadow, brutalShadow } from '../src/theme';

const TYPES = ['school', 'college', 'coaching'];
const PLANS = ['free', 'pro', 'enterprise'];

const typeStyle = (t: string) => {
  if (t === 'college') return { bg: colors.lavender, border: colors.lavenderBorder };
  if (t === 'coaching') return { bg: colors.peach, border: colors.peachBorder };
  return { bg: colors.mint, border: colors.mintBorder };
};

const empty = {
  id: '', name: '', type: 'school', city: '', state: '', country: '', address: '',
  phone: '', email: '', plan: 'free', active: true,
};

export default function Institutions() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await api.institutions() as any[]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(false); setForm(empty); setModalOpen(true); };
  const openEdit = (i: any) => { setEditing(true); setForm({ ...i }); setModalOpen(true); };

  const save = async () => {
    if (!form.name) { Alert.alert('Name required'); return; }
    setSaving(true);
    try {
      const { id, created_at, ...payload } = form;
      if (editing) await api.updateInstitution(id, payload);
      else await api.createInstitution(payload);
      setModalOpen(false);
      await load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  const remove = async (i: any) => {
    const go = async () => { try { await api.deleteInstitution(i.id); await load(); } catch (e: any) { Alert.alert('Error', e.message); } };
    if (Platform.OS === 'web') { if (window.confirm(`Delete ${i.name}?`)) go(); }
    else Alert.alert('Delete', `Delete ${i.name}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: go }]);
  };

  const summary = {
    total: items.length,
    school: items.filter((x) => x.type === 'school').length,
    college: items.filter((x) => x.type === 'college').length,
    coaching: items.filter((x) => x.type === 'coaching').length,
    active: items.filter((x) => x.active).length,
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Institutions</Text>
        <TouchableOpacity onPress={openAdd} testID="add-inst-btn">
          <Feather name="plus-circle" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 80 }}>
        <View style={styles.grid}>
          <Mini label="Total" value={summary.total} bg={colors.primaryLight} border={colors.primary} />
          <Mini label="Schools" value={summary.school} bg={colors.mint} border={colors.mintBorder} />
          <Mini label="Colleges" value={summary.college} bg={colors.lavender} border={colors.lavenderBorder} />
          <Mini label="Active" value={summary.active} bg={colors.peach} border={colors.peachBorder} />
        </View>

        <Text style={styles.sectionHeading}>Managed Institutions</Text>
        {loading ? <ActivityIndicator color={colors.primary} /> : items.length === 0 ? (
          <Text style={styles.meta}>No institutions yet. Tap + to add.</Text>
        ) : items.map((i) => {
          const ts = typeStyle(i.type);
          return (
            <View key={i.id} style={[styles.card, !i.active && { opacity: 0.6 }]}>
              <View style={[styles.typeBadge, { backgroundColor: ts.bg, borderColor: ts.border }]}>
                <Feather name={i.type === 'college' ? 'award' : i.type === 'coaching' ? 'zap' : 'home'} size={20} color={colors.textPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{i.name}</Text>
                <Text style={styles.cardMeta}>
                  {i.type.toUpperCase()} · {[i.city, i.state, i.country].filter(Boolean).join(', ') || 'No location'}
                </Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                  <View style={[styles.pill, { backgroundColor: i.active ? colors.mint : colors.coral, borderColor: i.active ? colors.mintBorder : colors.coralBorder }]}>
                    <Text style={styles.pillText}>{i.active ? 'ACTIVE' : 'INACTIVE'}</Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
                    <Text style={styles.pillText}>{i.plan.toUpperCase()}</Text>
                  </View>
                </View>
              </View>
              <View style={{ gap: 6 }}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(i)}><Feather name="edit-2" size={14} color={colors.primaryDark} /></TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.coral, borderColor: colors.coralBorder }]} onPress={() => remove(i)}><Feather name="trash-2" size={14} color={colors.coralText} /></TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView style={styles.modalBg} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.modalTitle}>{editing ? 'Edit Institution' : 'New Institution'}</Text>
                <TouchableOpacity onPress={() => setModalOpen(false)}>
                  <Feather name="x" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.label}>Type</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                {TYPES.map((t) => (
                  <TouchableOpacity key={t} onPress={() => setForm({ ...form, type: t })} style={[styles.chip, form.type === t && styles.chipActive]}>
                    <Text style={[styles.chipText, form.type === t && styles.chipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {(['name','city','state','country','address','phone','email'] as const).map((k) => (
                <View key={k} style={{ marginBottom: 10 }}>
                  <Text style={styles.label}>{k[0].toUpperCase() + k.slice(1)}{k === 'name' ? ' *' : ''}</Text>
                  <TextInput testID={`inst-${k}`} style={styles.input} value={form[k] || ''} onChangeText={(v) => setForm({ ...form, [k]: v })} autoCapitalize={k === 'email' ? 'none' : 'words'} />
                </View>
              ))}
              <Text style={styles.label}>Plan</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                {PLANS.map((p) => (
                  <TouchableOpacity key={p} onPress={() => setForm({ ...form, plan: p })} style={[styles.chip, form.plan === p && styles.chipActive]}>
                    <Text style={[styles.chipText, form.plan === p && styles.chipTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity onPress={() => setForm({ ...form, active: !form.active })} style={[styles.toggle, form.active && { backgroundColor: colors.mint, borderColor: colors.mintBorder }]}>
                <Feather name={form.active ? 'check-circle' : 'circle'} size={18} color={colors.textPrimary} />
                <Text style={styles.toggleText}>Active</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={save} disabled={saving} testID="save-inst-btn">
                {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryBtnText}>{editing ? 'Update' : 'Create'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const Mini = ({ label, value, bg, border }: any) => (
  <View style={[styles.mini, { backgroundColor: bg, borderColor: border }]}>
    <Text style={styles.miniValue}>{value}</Text>
    <Text style={styles.miniLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.appBg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screen, paddingVertical: 12 },
  title: { fontFamily: fonts.heading, fontSize: 18, color: colors.textPrimary },
  grid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  mini: { flex: 1, minWidth: '45%', padding: 14, borderRadius: radius.md, borderWidth: 1, ...softShadow },
  miniValue: { fontFamily: fonts.headingExtra, fontSize: 22, color: colors.textPrimary },
  miniLabel: { fontFamily: fonts.bodyMed, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  sectionHeading: { fontFamily: fonts.heading, fontSize: 16, color: colors.textPrimary, marginTop: 20, marginBottom: 10 },
  card: {
    flexDirection: 'row', gap: 12, backgroundColor: colors.white,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderDefault,
    padding: 14, marginBottom: 10, ...softShadow,
  },
  typeBadge: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  cardName: { fontFamily: fonts.heading, fontSize: 15, color: colors.textPrimary },
  cardMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  pillText: { fontFamily: fonts.bodySemi, fontSize: 10, color: colors.textPrimary, letterSpacing: 0.8 },
  iconBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  meta: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, marginTop: 8 },
  modalBg: { flex: 1, backgroundColor: 'rgba(17,24,39,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.white, padding: spacing.lg, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: colors.borderDefault, maxHeight: '90%' },
  modalTitle: { fontFamily: fonts.headingExtra, fontSize: 22, color: colors.textPrimary },
  label: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  input: { backgroundColor: colors.appBg, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: 10, padding: 12, fontFamily: fonts.bodyMed, fontSize: 14, color: colors.textPrimary },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.textPrimary },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textPrimary },
  chipTextActive: { color: colors.white },
  toggle: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.appBg, alignSelf: 'flex-start', marginBottom: 12 },
  toggleText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textPrimary },
  primaryBtn: { marginTop: 6, backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', ...brutalShadow },
  primaryBtnText: { color: colors.white, fontFamily: fonts.headingSemi, fontSize: 15 },
});
