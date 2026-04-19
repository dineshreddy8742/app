import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { api } from '../src/api';
import { colors, fonts, radius, spacing, softShadow, brutalShadow } from '../src/theme';

export default function Analytics() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setData(await api.attendanceAnalytics()); } finally { setLoading(false); }
    })();
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Attendance Analytics</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 60 }}>
        {loading || !data ? <ActivityIndicator color={colors.primary} /> : (
          <>
            <Text style={styles.sectionHeading}>Today</Text>
            <View style={styles.bigCard}>
              <Text style={styles.bigPct}>{data.today.pct}%</Text>
              <Text style={styles.bigLabel}>present today</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.min(100, data.today.pct)}%` }]} />
              </View>
              <View style={styles.miniRow}>
                <Stat label="Present" value={data.today.present} color={colors.mint} border={colors.mintBorder} />
                <Stat label="Absent" value={data.today.absent} color={colors.coral} border={colors.coralBorder} />
                <Stat label="Late" value={data.today.late} color={colors.warning} border={colors.warningBorder} />
              </View>
            </View>

            <Text style={styles.sectionHeading}>7-Day Trend</Text>
            <View style={styles.chartCard}>
              <View style={styles.chartRow}>
                {data.week_trend.map((d: any) => {
                  const h = Math.max(6, (d.pct / 100) * 120);
                  return (
                    <View key={d.date} style={styles.bar}>
                      <Text style={styles.barValue}>{d.pct}%</Text>
                      <View style={[styles.barFill, { height: h }]} />
                      <Text style={styles.barLabel}>{new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' })}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <Text style={styles.sectionHeading}>Periods</Text>
            <View style={styles.grid}>
              <Card label="This Month" pct={data.month.pct} present={data.month.present} total={data.month.total} bg={colors.lavender} border={colors.lavenderBorder} />
              <Card label="This Year" pct={data.year.pct} present={data.year.present} total={data.year.total} bg={colors.peach} border={colors.peachBorder} />
              <Card label="All-Time" pct={data.all_time.pct} present={data.all_time.present} total={data.all_time.total} bg={colors.mint} border={colors.mintBorder} />
              <Card label="Today" pct={data.today.pct} present={data.today.present} total={data.today.total} bg={colors.primaryLight} border={colors.primary} />
            </View>

            <Text style={styles.sectionHeading}>Class-wise (Today)</Text>
            {data.class_wise_today.length === 0 ? (
              <Text style={styles.meta}>No attendance marked today.</Text>
            ) : data.class_wise_today.map((c: any) => (
              <View key={c.class_name} style={styles.classRow}>
                <View style={[styles.classBadge, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
                  <Text style={styles.classBadgeText}>{c.class_name}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.classBar}>
                    <View style={[styles.classBarFill, { width: `${c.pct}%`, backgroundColor: c.pct >= 85 ? colors.mintBorder : c.pct >= 70 ? colors.peachBorder : colors.coralBorder }]} />
                  </View>
                  <Text style={styles.classMeta}>{c.present} / {c.total} present</Text>
                </View>
                <Text style={styles.classPct}>{c.pct}%</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const Stat = ({ label, value, color, border }: any) => (
  <View style={[styles.stat, { backgroundColor: color, borderColor: border }]}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const Card = ({ label, pct, present, total, bg, border }: any) => (
  <View style={[styles.gridCard, { backgroundColor: bg, borderColor: border }]}>
    <Text style={styles.gridPct}>{pct}%</Text>
    <Text style={styles.gridLabel}>{label}</Text>
    <Text style={styles.gridMeta}>{present}/{total}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.appBg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screen, paddingVertical: 12 },
  title: { fontFamily: fonts.heading, fontSize: 18, color: colors.textPrimary },
  sectionHeading: { fontFamily: fonts.heading, fontSize: 16, color: colors.textPrimary, marginTop: 20, marginBottom: 10 },
  bigCard: { padding: 20, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderDefault, ...brutalShadow },
  bigPct: { fontFamily: fonts.headingExtra, fontSize: 48, color: colors.textPrimary, letterSpacing: -1 },
  bigLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: -4 },
  progressBar: { marginTop: 14, height: 10, backgroundColor: colors.primaryLight, borderRadius: 999, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderDefault },
  progressFill: { height: '100%', backgroundColor: colors.primary },
  miniRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  stat: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  statValue: { fontFamily: fonts.headingExtra, fontSize: 18, color: colors.textPrimary },
  statLabel: { fontFamily: fonts.bodyMed, fontSize: 11, color: colors.textSecondary },
  chartCard: { padding: 14, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderDefault, ...softShadow },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 170, paddingTop: 20 },
  bar: { alignItems: 'center', gap: 4, flex: 1 },
  barValue: { fontFamily: fonts.bodySemi, fontSize: 10, color: colors.textSecondary },
  barFill: { width: 20, backgroundColor: colors.primary, borderRadius: 6, borderWidth: 1, borderColor: colors.borderDefault },
  barLabel: { fontFamily: fonts.bodyMed, fontSize: 10, color: colors.textSecondary, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCard: { width: '48%', padding: 14, borderRadius: radius.md, borderWidth: 1, ...softShadow },
  gridPct: { fontFamily: fonts.headingExtra, fontSize: 26, color: colors.textPrimary },
  gridLabel: { fontFamily: fonts.heading, fontSize: 13, color: colors.textPrimary, marginTop: 2 },
  gridMeta: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  classRow: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderDefault, padding: 12, marginBottom: 8, ...softShadow },
  classBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  classBadgeText: { fontFamily: fonts.headingSemi, fontSize: 11, color: colors.textPrimary },
  classBar: { height: 8, backgroundColor: colors.borderSubtle, borderRadius: 999, overflow: 'hidden' },
  classBarFill: { height: '100%' },
  classMeta: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  classPct: { fontFamily: fonts.headingExtra, fontSize: 16, color: colors.textPrimary, minWidth: 50, textAlign: 'right' },
  meta: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary },
});
