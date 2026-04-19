import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, TouchableOpacity,
  Modal, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../src/auth';
import { api } from '../../src/api';
import { colors, fonts, radius, spacing, softShadow, brutalShadow } from '../../src/theme';

type Student = {
  id: string;
  name: string;
  email: string;
  roll_no: string;
  class_name: string;
  section: string;
  phone?: string | null;
};

const emptyForm = {
  id: '', name: '', email: '', password: '', roll_no: '',
  class_name: '10-A', section: 'A', phone: '',
};

export default function Students() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'teacher';
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Student[]>([]);
  const [q, setQ] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [csvModal, setCsvModal] = useState(false);
  const [csvText, setCsvText] = useState('name,email,roll_no,class_name,section,phone,password\n');
  const [csvSaving, setCsvSaving] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const runImport = async () => {
    setCsvSaving(true);
    try {
      const r: any = await api.importStudentsCSV(csvText);
      setCsvModal(false);
      await load();
      Alert.alert('Import done', `Created: ${r.created}, Skipped: ${r.skipped}${r.errors?.length ? '\n' + r.errors.slice(0, 5).join('\n') : ''}`);
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setCsvSaving(false); }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list: any = await api.students();
      setItems(list);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((s) => {
    if (!q) return true;
    const k = q.toLowerCase();
    return s.name.toLowerCase().includes(k) ||
      s.roll_no.toLowerCase().includes(k) ||
      s.class_name.toLowerCase().includes(k);
  });

  const openAdd = () => {
    setEditing(false);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (s: Student) => {
    setEditing(true);
    setForm({
      id: s.id, name: s.name, email: s.email, password: '',
      roll_no: s.roll_no, class_name: s.class_name,
      section: s.section, phone: s.phone || '',
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name || !form.roll_no || !form.class_name) {
      Alert.alert('Missing fields', 'Name, roll no and class are required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const payload: any = {
          name: form.name, roll_no: form.roll_no,
          class_name: form.class_name, section: form.section,
          phone: form.phone,
        };
        if (form.password) payload.password = form.password;
        await api.updateStudent(form.id, payload);
      } else {
        if (!form.email || !form.password) {
          Alert.alert('Missing fields', 'Email and password are required for new student');
          setSaving(false);
          return;
        }
        await api.createStudent({
          name: form.name, email: form.email, password: form.password,
          roll_no: form.roll_no, class_name: form.class_name,
          section: form.section, phone: form.phone,
        });
      }
      setModalOpen(false);
      await load();
      Alert.alert('Success', editing ? 'Student updated' : 'Student added');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const remove = async (s: Student) => {
    const go = async () => {
      try {
        await api.deleteStudent(s.id);
        await load();
      } catch (e: any) { Alert.alert('Error', e.message); }
    };
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Delete ${s.name}?`)) go();
    } else {
      Alert.alert('Delete student', `Delete ${s.name}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: go },
      ]);
    }
  };

  const title = user?.role === 'parent' ? 'My Children' : 'Students';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 100 }}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.h1}>{title}</Text>
            <Text style={styles.sub}>{items.length} total</Text>
          </View>
          {canManage && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity testID="import-csv-btn" style={[styles.addBtn, { backgroundColor: colors.textPrimary }]} onPress={() => setCsvModal(true)}>
                <Feather name="upload" size={16} color={colors.white} />
                <Text style={styles.addText}>Import</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="add-student-btn" style={styles.addBtn} onPress={openAdd}>
                <Feather name="plus" size={18} color={colors.white} />
                <Text style={styles.addText}>Add</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.searchWrap}>
          <Feather name="search" size={18} color={colors.textSecondary} />
          <TextInput
            testID="student-search-input"
            style={styles.searchInput}
            placeholder="Search by name, roll no, class"
            placeholderTextColor={colors.textTertiary}
            value={q}
            onChangeText={setQ}
          />
        </View>

        {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} /> : filtered.map((s) => (
          <View key={s.id} style={styles.card} testID={`student-card-${s.roll_no}`}>
            <View style={[styles.avatar, { backgroundColor: colors.peach, borderColor: colors.peachBorder }]}>
              <Text style={styles.avatarText}>{s.name[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{s.name}</Text>
              <Text style={styles.meta}>Class {s.class_name} · Roll {s.roll_no}</Text>
              {s.phone ? <Text style={styles.metaSm}>{s.phone}</Text> : null}
            </View>
            {canManage && (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity testID={`edit-${s.roll_no}`} style={styles.iconBtn} onPress={() => openEdit(s)}>
                  <Feather name="edit-2" size={16} color={colors.primaryDark} />
                </TouchableOpacity>
                <TouchableOpacity testID={`delete-${s.roll_no}`} style={[styles.iconBtn, { backgroundColor: colors.coral, borderColor: colors.coralBorder }]} onPress={() => remove(s)}>
                  <Feather name="trash-2" size={16} color={colors.coralText} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        {!loading && filtered.length === 0 && (
          <View style={styles.empty}>
            <Feather name="users" size={32} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No students found</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={csvModal} animationType="slide" transparent onRequestClose={() => setCsvModal(false)}>
        <KeyboardAvoidingView style={styles.modalBg} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.modalTitle}>Bulk Import (CSV)</Text>
                <TouchableOpacity onPress={() => setCsvModal(false)} testID="close-csv">
                  <Feather name="x" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.label}>Paste CSV (headers: name,email,roll_no,class_name,section,phone,password)</Text>
              <TextInput
                testID="csv-textarea"
                multiline
                style={[styles.input, { height: 220, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12 }]}
                value={csvText}
                onChangeText={setCsvText}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="name,email,roll_no,class_name,section,phone,password\nAlex Doe,alex@school.com,10B03,10-B,B,+1234,pass123"
                placeholderTextColor={colors.textTertiary}
              />
              <TouchableOpacity testID="run-import-btn" style={styles.primaryBtn} onPress={runImport} disabled={csvSaving}>
                {csvSaving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryBtnText}>Import Students</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView style={styles.modalBg} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.modalTitle}>{editing ? 'Edit Student' : 'Add Student'}</Text>
                <TouchableOpacity onPress={() => setModalOpen(false)} testID="close-modal">
                  <Feather name="x" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {['name', 'email', 'roll_no', 'class_name', 'section', 'phone'].map((field) => (
                <View key={field} style={{ marginBottom: 10 }}>
                  <Text style={styles.label}>{labelize(field)}{['name', 'roll_no', 'class_name'].includes(field) ? ' *' : ''}</Text>
                  <TextInput
                    testID={`form-${field}`}
                    style={styles.input}
                    value={form[field]}
                    editable={!(editing && field === 'email')}
                    onChangeText={(v) => setForm({ ...form, [field]: v })}
                    autoCapitalize={field === 'email' ? 'none' : 'words'}
                    keyboardType={field === 'email' ? 'email-address' : field === 'phone' ? 'phone-pad' : 'default'}
                  />
                </View>
              ))}

              <Text style={styles.label}>
                {editing ? 'New Password (optional)' : 'Password *'}
              </Text>
              <TextInput
                testID="form-password"
                style={styles.input}
                value={form.password}
                onChangeText={(v) => setForm({ ...form, password: v })}
                secureTextEntry
                placeholder={editing ? 'Leave blank to keep current' : 'Student will use roll_no + this password'}
                placeholderTextColor={colors.textTertiary}
              />

              <TouchableOpacity testID="save-student-btn" style={styles.primaryBtn} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.white} /> : (
                  <Text style={styles.primaryBtnText}>{editing ? 'Update Student' : 'Create Student'}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function labelize(k: string) {
  return k.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.appBg },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  h1: { fontFamily: fonts.headingExtra, fontSize: 28, color: colors.textPrimary, letterSpacing: -0.5 },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  addBtn: {
    flexDirection: 'row', gap: 6, backgroundColor: colors.primary,
    borderWidth: 1, borderColor: colors.borderDefault, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', ...softShadow,
  },
  addText: { color: colors.white, fontFamily: fonts.headingSemi, fontSize: 13 },
  searchWrap: {
    marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderDefault,
    borderRadius: 12, paddingHorizontal: 14, height: 48, ...softShadow,
  },
  searchInput: { flex: 1, fontFamily: fonts.bodyMed, fontSize: 15, color: colors.textPrimary },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12,
    backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.borderDefault, padding: 14, ...softShadow,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontFamily: fonts.headingExtra, fontSize: 18, color: colors.textPrimary },
  name: { fontFamily: fonts.heading, fontSize: 16, color: colors.textPrimary },
  meta: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  metaSm: { fontFamily: fonts.body, fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: colors.primary,
    backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  empty: {
    marginTop: 32, padding: 32, alignItems: 'center', backgroundColor: colors.white,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSubtle,
  },
  emptyText: { fontFamily: fonts.bodyMed, fontSize: 14, color: colors.textSecondary, marginTop: 8 },
  modalBg: { flex: 1, backgroundColor: 'rgba(17,24,39,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.white, padding: spacing.lg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: colors.borderDefault,
    maxHeight: '90%',
  },
  modalTitle: { fontFamily: fonts.headingExtra, fontSize: 22, color: colors.textPrimary },
  label: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  input: {
    backgroundColor: colors.appBg, borderWidth: 1, borderColor: colors.borderDefault,
    borderRadius: 10, padding: 12, fontFamily: fonts.bodyMed, fontSize: 14, color: colors.textPrimary,
  },
  primaryBtn: {
    marginTop: 16, backgroundColor: colors.primary, borderWidth: 1,
    borderColor: colors.borderDefault, borderRadius: radius.md, paddingVertical: 14,
    alignItems: 'center', ...brutalShadow,
  },
  primaryBtnText: { color: colors.white, fontFamily: fonts.headingSemi, fontSize: 15 },
});
