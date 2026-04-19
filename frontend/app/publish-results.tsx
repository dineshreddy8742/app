import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { api } from '../src/api';
import { colors, fonts, radius, spacing, softShadow, brutalShadow } from '../src/theme';

export default function PublishResults() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [students, setStudents] = useState<any[]>([]);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try { setExams(await api.exams() as any[]); } finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!selectedExamId) return;
    const exam = exams.find((e) => e.id === selectedExamId);
    if (!exam) return;
    (async () => {
      const list: any = await api.students(exam.class_name);
      setStudents(list);
      // fetch existing results for this exam
      try {
        // use existing list_results — but we want all results for the exam. Not available;
        // instead, fetch per-student results: skip for now, keep empty.
      } catch {}
    })();
  }, [selectedExamId, exams]);

  const publish = async () => {
    if (!selectedExamId) { Alert.alert('Pick an exam'); return; }
    const records = students
      .filter((s) => marks[s.id] && !isNaN(Number(marks[s.id])))
      .map((s) => ({ student_id: s.id, marks: Number(marks[s.id]) }));
    if (!records.length) { Alert.alert('No marks entered'); return; }
    setSaving(true);
    try {
      const res = await api.publishResults(selectedExamId, records);
      Alert.alert('Published', `Notifications sent. ${JSON.stringify(res)}`);
      setMarks({});
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  const exam = exams.find((e) => e.id === selectedExamId);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Publish Results</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 80 }}>
        {loading ? <ActivityIndicator color={colors.primary} /> : (
          <>
            <Text style={styles.section}>Select Exam</Text>
            <View style={{ gap: 8 }}>
              {exams.map((e) => (
                <TouchableOpacity
                  key={e.id}
                  testID={`exam-${e.id}`}
                  onPress={() => setSelectedExamId(e.id)}
                  style={[styles.examBtn, selectedExamId === e.id && styles.examActive]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.examName, selectedExamId === e.id && { color: colors.white }]}>
                      {e.name} · {e.subject}
                    </Text>
                    <Text style={[styles.examMeta, selectedExamId === e.id && { color: '#E5E7EB' }]}>
                      {e.class_name} · {e.date} · Max {e.max_marks}
                    </Text>
                  </View>
                  {selectedExamId === e.id && <Feather name="check" size={20} color={colors.white} />}
                </TouchableOpacity>
              ))}
              {exams.length === 0 && <Text style={styles.meta}>No exams configured.</Text>}
            </View>

            {exam && (
              <>
                <Text style={styles.section}>Enter Marks (out of {exam.max_marks})</Text>
                {students.map((s) => (
                  <View key={s.id} style={styles.row}>
                    <View style={[styles.avatar, { backgroundColor: colors.peach, borderColor: colors.peachBorder }]}>
                      <Text style={styles.avatarText}>{s.name[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{s.name}</Text>
                      <Text style={styles.meta}>Roll {s.roll_no}</Text>
                    </View>
                    <TextInput
                      testID={`mark-${s.id}`}
                      style={styles.marksInput}
                      keyboardType="numeric"
                      value={marks[s.id] || ''}
                      onChangeText={(v) => setMarks({ ...marks, [s.id]: v })}
                      placeholder="-"
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                ))}

                <TouchableOpacity testID="publish-btn" style={[styles.publishBtn, saving && { opacity: 0.7 }]} onPress={publish} disabled={saving}>
                  {saving ? <ActivityIndicator color={colors.white} /> : (
                    <>
                      <Feather name="send" size={18} color={colors.white} />
                      <Text style={styles.publishText}>Publish & Notify Parents</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.appBg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screen, paddingVertical: 12 },
  title: { fontFamily: fonts.heading, fontSize: 18, color: colors.textPrimary },
  section: { fontFamily: fonts.heading, fontSize: 16, color: colors.textPrimary, marginTop: 16, marginBottom: 10 },
  examBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderDefault,
    padding: 14, ...softShadow,
  },
  examActive: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  examName: { fontFamily: fonts.heading, fontSize: 15, color: colors.textPrimary },
  examMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.borderDefault, padding: 12, marginBottom: 8, ...softShadow,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontFamily: fonts.headingExtra, fontSize: 16, color: colors.textPrimary },
  name: { fontFamily: fonts.heading, fontSize: 14, color: colors.textPrimary },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  marksInput: {
    width: 70, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8, fontFamily: fonts.headingSemi, fontSize: 16, textAlign: 'center',
    backgroundColor: colors.appBg, color: colors.textPrimary,
  },
  publishBtn: {
    marginTop: 20, backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.borderDefault,
    borderRadius: radius.md, paddingVertical: 14, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 8, ...brutalShadow,
  },
  publishText: { color: colors.white, fontFamily: fonts.headingSemi, fontSize: 15 },
});
