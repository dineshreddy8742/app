import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { colors, fonts, radius, spacing, softShadow } from '../../src/theme';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export default function Timetable() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDay, setSelectedDay] = useState(DAYS[new Date().getDay() - 1] || 'Mon');
  const [slots, setSlots] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      if (user?.role === 'student' || user?.role === 'parent') {
        const data: any = await api.timetable();
        setSlots(data);
        setLoading(false);
      } else {
        const cls: any = await api.classes();
        const names = cls.map((c: any) => c.name);
        setClasses(names);
        setSelectedClass(names[0] || '');
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!selectedClass) return;
    (async () => {
      setLoading(true);
      const data: any = await api.timetable(selectedClass);
      setSlots(data);
      setLoading(false);
    })();
  }, [selectedClass]);

  const daySlots = slots.filter((s: any) => s.day === selectedDay).sort((a: any, b: any) => a.period - b.period);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 100 }}>
        <Text style={styles.h1}>Timetable</Text>

        {classes.length > 0 && (
          <View style={styles.tabs}>
            {classes.map((c) => (
              <TouchableOpacity key={c} onPress={() => setSelectedClass(c)} style={[styles.tab, selectedClass === c && styles.tabActive]}>
                <Text style={[styles.tabText, selectedClass === c && styles.tabTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.daysRow}>
          {DAYS.map((d) => (
            <TouchableOpacity
              key={d}
              testID={`day-${d}`}
              onPress={() => setSelectedDay(d)}
              style={[styles.dayBtn, selectedDay === d && styles.dayActive]}
            >
              <Text style={[styles.dayText, selectedDay === d && styles.dayTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} /> : daySlots.length === 0 ? (
          <Text style={styles.meta}>No classes scheduled for {selectedDay}.</Text>
        ) : daySlots.map((s: any) => (
          <View key={s.id} style={styles.slot}>
            <View style={styles.timePill}><Text style={styles.timePillText}>{s.time}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.subject}>{s.subject}</Text>
              <Text style={styles.sub}>{s.teacher_name} • Period {s.period}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.appBg },
  h1: { fontFamily: fonts.headingExtra, fontSize: 28, color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 16 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tab: {
    paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.borderDefault,
    borderRadius: 999, backgroundColor: colors.white,
  },
  tabActive: { backgroundColor: colors.textPrimary },
  tabText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textPrimary },
  tabTextActive: { color: colors.white },
  daysRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  dayBtn: {
    flex: 1, paddingVertical: 10, borderWidth: 1, borderColor: colors.borderDefault,
    borderRadius: 12, backgroundColor: colors.white, alignItems: 'center', ...softShadow,
  },
  dayActive: { backgroundColor: colors.primary },
  dayText: { fontFamily: fonts.headingSemi, fontSize: 13, color: colors.textPrimary },
  dayTextActive: { color: colors.white },
  slot: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.borderDefault, padding: 14, marginBottom: 10, ...softShadow,
  },
  timePill: {
    backgroundColor: colors.peach, borderWidth: 1, borderColor: colors.peachBorder,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, minWidth: 96, alignItems: 'center',
  },
  timePillText: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.textPrimary },
  subject: { fontFamily: fonts.heading, fontSize: 15, color: colors.textPrimary },
  sub: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  meta: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, marginTop: 16 },
});
