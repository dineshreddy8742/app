import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { api } from '../src/api';
import { colors, fonts, radius, spacing, softShadow } from '../src/theme';

export default function Results() {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const [r, e]: any = await Promise.all([api.results(), api.exams()]);
        setResults(r);
        setExams(e);
      } finally { setLoading(false); }
    })();
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Exams & Results</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 60 }}>
        {loading ? <ActivityIndicator color={colors.primary} /> : (
          <>
            <Text style={styles.section}>Upcoming / Past Exams</Text>
            {exams.map((e) => (
              <View key={e.id} style={styles.examCard}>
                <Feather name="book-open" size={18} color={colors.peachBorder} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.examTitle}>{e.name} - {e.subject}</Text>
                  <Text style={styles.meta}>{e.class_name} • {e.date} • Max {e.max_marks}</Text>
                </View>
              </View>
            ))}
            {exams.length === 0 && <Text style={styles.meta}>No exams yet.</Text>}

            <Text style={[styles.section, { marginTop: 24 }]}>My Results</Text>
            {results.map((r) => (
              <View key={r.id} style={styles.resultCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.examTitle}>{r.exam?.subject}</Text>
                  <Text style={styles.meta}>{r.exam?.name} • {r.exam?.date}</Text>
                </View>
                <View style={styles.gradeBox}>
                  <Text style={styles.marks}>{r.marks}<Text style={styles.maxMarks}>/{r.exam?.max_marks}</Text></Text>
                  <View style={[styles.gradeBadge, gradeColor(r.grade)]}>
                    <Text style={styles.gradeText}>{r.grade}</Text>
                  </View>
                </View>
              </View>
            ))}
            {results.length === 0 && <Text style={styles.meta}>No results published yet.</Text>}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function gradeColor(grade: string) {
  if (grade === 'A+' || grade === 'A') return { backgroundColor: colors.mint, borderColor: colors.mintBorder };
  if (grade === 'B') return { backgroundColor: colors.peach, borderColor: colors.peachBorder };
  return { backgroundColor: colors.coral, borderColor: colors.coralBorder };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.appBg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screen, paddingVertical: 12 },
  title: { fontFamily: fonts.heading, fontSize: 18, color: colors.textPrimary },
  section: { fontFamily: fonts.heading, fontSize: 16, color: colors.textPrimary, marginBottom: 12 },
  examCard: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderDefault, padding: 14, marginBottom: 10, ...softShadow },
  examTitle: { fontFamily: fonts.heading, fontSize: 15, color: colors.textPrimary },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  resultCard: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderDefault, padding: 14, marginBottom: 10, ...softShadow },
  gradeBox: { alignItems: 'flex-end', gap: 4 },
  marks: { fontFamily: fonts.headingExtra, fontSize: 20, color: colors.textPrimary },
  maxMarks: { fontFamily: fonts.body, fontSize: 12, color: colors.textTertiary },
  gradeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  gradeText: { fontFamily: fonts.headingSemi, fontSize: 12, color: colors.textPrimary },
});
