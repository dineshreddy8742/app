import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../src/auth';
import { api } from '../src/api';
import { colors, fonts, radius, spacing, softShadow, brutalShadow } from '../src/theme';

const FILE_TYPES = ['pdf', 'image', 'video', 'link'];

export default function Materials() {
  const { user } = useAuth();
  const router = useRouter();
  const canManage = user?.role === 'admin' || user?.role === 'teacher';
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<any>({
    title: '', description: '', subject: '', class_name: '', file_url: '', file_name: '', file_type: 'pdf',
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await api.materials() as any[]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.title || !form.file_url) {
      Alert.alert('Missing', 'Title and file URL are required'); return;
    }
    setSaving(true);
    try {
      await api.createMaterial(form);
      setModalOpen(false);
      setForm({ title: '', description: '', subject: '', class_name: '', file_url: '', file_name: '', file_type: 'pdf' });
      await load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  const open = async (url: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(url, '_blank');
    else await Linking.openURL(url);
  };

  const remove = async (id: string) => {
    const go = async () => {
      try { await api.deleteMaterial(id); await load(); } catch (e: any) { Alert.alert('Error', e.message); }
    };
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Delete this material?')) go();
    } else {
      Alert.alert('Delete', 'Delete this material?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: go },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="materials-back">
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Study Materials</Text>
        {canManage ? (
          <TouchableOpacity onPress={() => setModalOpen(true)} testID="add-material-btn">
            <Feather name="plus-circle" size={24} color={colors.primary} />
          </TouchableOpacity>
        ) : <View style={{ width: 24 }} />}
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 60 }}>
        {loading ? <ActivityIndicator color={colors.primary} /> : items.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="book-open" size={32} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No study materials yet.</Text>
            {canManage && <Text style={styles.emptyHint}>Tap + to upload notes, PDFs or video links.</Text>}
          </View>
        ) : items.map((m) => (
          <View key={m.id} style={styles.card}>
            <View style={[styles.iconBox, typeColor(m.file_type)]}>
              <Feather name={typeIcon(m.file_type) as any} size={18} color={colors.textPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{m.title}</Text>
              {m.description ? <Text style={styles.cardDesc}>{m.description}</Text> : null}
              <Text style={styles.cardMeta}>
                {m.subject ? `${m.subject} · ` : ''}{m.class_name ? `${m.class_name} · ` : ''}{m.uploaded_by_name}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={styles.openBtn} onPress={() => open(m.file_url)} testID={`open-${m.id}`}>
                  <Feather name="external-link" size={13} color={colors.white} />
                  <Text style={styles.openText}>{m.file_name || 'Open'}</Text>
                </TouchableOpacity>
                {canManage ? (
                  <TouchableOpacity style={styles.delBtn} onPress={() => remove(m.id)} testID={`del-${m.id}`}>
                    <Feather name="trash-2" size={13} color={colors.coralText} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView style={styles.modalBg} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.modalTitle}>Upload Material</Text>
                <TouchableOpacity onPress={() => setModalOpen(false)}>
                  <Feather name="x" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {([
                ['title', 'Title *', 'Algebra Chapter 5 Notes'],
                ['description', 'Description', 'Key concepts and examples'],
                ['subject', 'Subject', 'Mathematics'],
                ['class_name', 'Class (leave blank for everyone)', '10-A'],
                ['file_url', 'File URL or base64 *', 'https://… or data:application/pdf;base64,…'],
                ['file_name', 'Display name', 'algebra-ch5.pdf'],
              ] as const).map(([k, lbl, ph]) => (
                <View key={k} style={{ marginBottom: 10 }}>
                  <Text style={styles.label}>{lbl}</Text>
                  <TextInput
                    testID={`mat-${k}`}
                    style={styles.input}
                    value={form[k]}
                    onChangeText={(v) => setForm({ ...form, [k]: v })}
                    placeholder={ph}
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize={k === 'file_url' ? 'none' : 'sentences'}
                  />
                </View>
              ))}
              <Text style={styles.label}>Type</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {FILE_TYPES.map((t) => (
                  <TouchableOpacity key={t} onPress={() => setForm({ ...form, file_type: t })} style={[styles.chip, form.file_type === t && styles.chipActive]}>
                    <Text style={[styles.chipText, form.file_type === t && styles.chipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity testID="save-material-btn" style={styles.submitBtn} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>Upload & Notify</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function typeIcon(t: string) {
  if (t === 'pdf') return 'file-text';
  if (t === 'image') return 'image';
  if (t === 'video') return 'play-circle';
  return 'link';
}
function typeColor(t: string) {
  if (t === 'pdf') return { backgroundColor: colors.coral, borderColor: colors.coralBorder };
  if (t === 'image') return { backgroundColor: colors.peach, borderColor: colors.peachBorder };
  if (t === 'video') return { backgroundColor: colors.lavender, borderColor: colors.lavenderBorder };
  return { backgroundColor: colors.mint, borderColor: colors.mintBorder };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.appBg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screen, paddingVertical: 12 },
  title: { fontFamily: fonts.heading, fontSize: 18, color: colors.textPrimary },
  card: {
    flexDirection: 'row', gap: 12, backgroundColor: colors.white, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.borderDefault, padding: 14, marginBottom: 10, ...softShadow,
  },
  iconBox: { width: 42, height: 42, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontFamily: fonts.heading, fontSize: 15, color: colors.textPrimary },
  cardDesc: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  cardMeta: { fontFamily: fonts.body, fontSize: 11, color: colors.textTertiary, marginTop: 4 },
  openBtn: {
    flexDirection: 'row', gap: 6, backgroundColor: colors.primary,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, borderColor: colors.borderDefault, alignItems: 'center',
  },
  openText: { color: colors.white, fontFamily: fonts.bodySemi, fontSize: 12 },
  delBtn: {
    backgroundColor: colors.coral, borderWidth: 1, borderColor: colors.coralBorder,
    paddingHorizontal: 10, borderRadius: 999, justifyContent: 'center',
  },
  empty: { padding: 32, alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSubtle },
  emptyText: { fontFamily: fonts.bodyMed, fontSize: 14, color: colors.textSecondary, marginTop: 8 },
  emptyHint: { fontFamily: fonts.body, fontSize: 12, color: colors.textTertiary, marginTop: 4 },
  modalBg: { flex: 1, backgroundColor: 'rgba(17,24,39,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.white, padding: spacing.lg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: colors.borderDefault, maxHeight: '90%',
  },
  modalTitle: { fontFamily: fonts.headingExtra, fontSize: 22, color: colors.textPrimary },
  label: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  input: { backgroundColor: colors.appBg, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: 10, padding: 12, fontFamily: fonts.bodyMed, fontSize: 14, color: colors.textPrimary },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.textPrimary },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textPrimary },
  chipTextActive: { color: colors.white },
  submitBtn: { marginTop: 6, backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', ...brutalShadow },
  submitText: { color: colors.white, fontFamily: fonts.headingSemi, fontSize: 15 },
});
