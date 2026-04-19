import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../src/auth';
import { api } from '../../src/api';
import { colors, fonts, radius, spacing, brutalShadow, softShadow } from '../../src/theme';

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  present: { bg: colors.mint, border: colors.mintBorder, text: colors.mintText },
  absent: { bg: colors.coral, border: colors.coralBorder, text: colors.coralText },
  late: { bg: colors.warning, border: colors.warningBorder, text: colors.warningText },
};

export default function Attendance() {
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'teacher';
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [students, setStudents] = useState<any[]>([]);
  const [marks, setMarks] = useState<Record<string, 'present' | 'absent' | 'late'>>({});
  const [saving, setSaving] = useState(false);
  const [myRecords, setMyRecords] = useState<any[]>([]);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    (async () => {
      try {
        if (isStaff) {
          const cls: any = await api.classes();
          const names = cls.map((c: any) => c.name);
          setClasses(names);
          setSelectedClass(names[0] || '');
        } else {
          const recs: any = await api.attendance();
          setMyRecords(recs);
        }
      } finally { setLoading(false); }
    })();
  }, [isStaff]);

  const loadStudents = useCallback(async (cls: string) => {
    if (!cls) return;
    setLoading(true);
    try {
      const list: any = await api.students(cls);
      setStudents(list);
      // load today's existing attendance
      const existing: any = await api.attendance({ class_name: cls, date_from: today, date_to: today });
      const m: Record<string, any> = {};
      existing.forEach((r: any) => { m[r.student_id] = r.status; });
      // default to "present" for all if not set
      list.forEach((s: any) => { if (!m[s.id]) m[s.id] = 'present'; });
      setMarks(m);
    } finally { setLoading(false); }
  }, [today]);

  useEffect(() => {
    if (isStaff && selectedClass) loadStudents(selectedClass);
  }, [selectedClass, isStaff, loadStudents]);

  const setMark = (id: string, status: 'present' | 'absent' | 'late') => {
    setMarks((m) => ({ ...m, [id]: status }));
  };

  const bulkSet = (status: 'present' | 'absent' | 'late') => {
    const m: Record<string, any> = {};
    students.forEach((s) => { m[s.id] = status; });
    setMarks(m);
  };

  const save = async () => {
    setSaving(true);
    try {
      const records = Object.entries(marks).map(([student_id, status]) => ({ student_id, status }));
      await api.markAttendance(selectedClass, today, records);
      Alert.alert('Saved', 'Attendance has been recorded.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  if (loading) {
    return <SafeAreaView style={styles.safe}><ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} /></SafeAreaView>;
  }

  if (!isStaff) {
    // Student view: history calendar
    const byDate: Record<string, string> = {};
    myRecords.forEach((r: any) => { byDate[r.date] = r.status; });
    const total = myRecords.length;
    const present = myRecords.filter((r) => r.status === 'present').length;
    const pct = total ? Math.round((present / total) * 100) : 0;
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 100 }}>
          <Text style={styles.h1}>My Attendance</Text>
          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>Attendance Rate</Text>
            <Text style={styles.statsValue} testID="student-attendance-rate">{pct}%</Text>
            <Text style={styles.statsMeta}>{present} present out of {total} days</Text>
          </View>
          <Text style={styles.sectionHeading}>Recent History</Text>
          {myRecords.slice(0, 20).map((r: any) => {
            const c = STATUS_COLORS[r.status];
            return (
              <View key={r.id} style={styles.historyRow}>
                <Text style={styles.historyDate}>{r.date}</Text>
                <View style={[styles.statusBadge, { backgroundColor: c.bg, borderColor: c.border }]}>
                  <Text style={[styles.statusText, { color: c.text }]}>{r.status.toUpperCase()}</Text>
                </View>
              </View>
            );
          })}
          {myRecords.length === 0 && <Text style={styles.statsMeta}>No records yet.</Text>}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 120 }}>
        <Text style={styles.h1}>Mark Attendance</Text>
        <Text style={styles.sub}>{today}</Text>

        <View style={styles.tabs}>
          {classes.map((c) => (
            <TouchableOpacity
              key={c}
              testID={`class-tab-${c}`}
              onPress={() => setSelectedClass(c)}
              style={[styles.tab, selectedClass === c && styles.tabActive]}
            >
              <Text style={[styles.tabText, selectedClass === c && styles.tabTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.bulkRow}>
          <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: colors.mint, borderColor: colors.mintBorder }]} onPress={() => bulkSet('present')}>
            <Text style={styles.bulkText}>All Present</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: colors.coral, borderColor: colors.coralBorder }]} onPress={() => bulkSet('absent')}>
            <Text style={styles.bulkText}>All Absent</Text>
          </TouchableOpacity>
        </View>

        {students.map((s) => {
          const current = marks[s.id] || 'present';
          const c = STATUS_COLORS[current];
          return (
            <View key={s.id} style={styles.studentRow} testID={`student-row-${s.roll_no}`}>
              <View style={[styles.avatar, { backgroundColor: c.bg, borderColor: c.border }]}>
                <Text style={styles.avatarText}>{s.name[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.studentName}>{s.name}</Text>
                <Text style={styles.studentMeta}>Roll {s.roll_no}</Text>
              </View>
              <View style={styles.toggleGroup}>
                {(['present', 'absent', 'late'] as const).map((st) => {
                  const active = current === st;
                  const col = STATUS_COLORS[st];
                  return (
                    <TouchableOpacity
                      key={st}
                      testID={`mark-${s.id}-${st}`}
                      onPress={() => setMark(s.id, st)}
                      style={[
                        styles.toggleBtn,
                        active && { backgroundColor: col.bg, borderColor: col.border },
                      ]}
                    >
                      <Feather
                        name={st === 'present' ? 'check' : st === 'absent' ? 'x' : 'clock'}
                        size={16}
                        color={active ? col.text : colors.textTertiary}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}

        <TouchableOpacity
          testID="save-attendance-btn"
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={save}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color={colors.white} /> : (
            <>
              <Feather name="save" size={18} color={colors.white} />
              <Text style={styles.saveText}>Save Attendance</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.appBg },
  h1: { fontFamily: fonts.headingExtra, fontSize: 28, color: colors.textPrimary, letterSpacing: -0.5 },
  sub: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: 16 },
  sectionHeading: { fontFamily: fonts.heading, fontSize: 18, color: colors.textPrimary, marginTop: 24, marginBottom: 12 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  tab: {
    paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1,
    borderColor: colors.borderDefault, borderRadius: 999, backgroundColor: colors.white,
  },
  tabActive: { backgroundColor: colors.textPrimary },
  tabText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textPrimary },
  tabTextActive: { color: colors.white },
  bulkRow: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 12 },
  bulkBtn: {
    flex: 1, borderWidth: 1, paddingVertical: 10, borderRadius: radius.md, alignItems: 'center', ...softShadow,
  },
  bulkText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textPrimary },
  studentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.borderDefault, padding: 12, marginBottom: 10, ...softShadow,
  },
  avatar: {
    width: 42, height: 42, borderRadius: 21, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontFamily: fonts.headingExtra, fontSize: 16, color: colors.textPrimary },
  studentName: { fontFamily: fonts.heading, fontSize: 15, color: colors.textPrimary },
  studentMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  toggleGroup: { flexDirection: 'row', gap: 6 },
  toggleBtn: {
    width: 36, height: 36, borderRadius: 10, borderWidth: 1,
    borderColor: colors.borderSubtle, backgroundColor: colors.appBg,
    justifyContent: 'center', alignItems: 'center',
  },
  saveBtn: {
    marginTop: 24, backgroundColor: colors.primary,
    borderWidth: 1, borderColor: colors.borderDefault,
    borderRadius: radius.md, height: 54,
    flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center',
    ...brutalShadow,
  },
  saveText: { color: colors.white, fontFamily: fonts.headingSemi, fontSize: 16 },
  statsCard: {
    marginTop: 16, padding: 20, backgroundColor: colors.white, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.borderDefault, ...brutalShadow,
  },
  statsLabel: { fontFamily: fonts.bodyMed, fontSize: 13, color: colors.textSecondary },
  statsValue: { fontFamily: fonts.headingExtra, fontSize: 40, color: colors.textPrimary, marginTop: 4 },
  statsMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  historyRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.borderSubtle, padding: 14, marginBottom: 8,
  },
  historyDate: { fontFamily: fonts.bodyMed, fontSize: 14, color: colors.textPrimary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  statusText: { fontFamily: fonts.bodySemi, fontSize: 11 },
});
