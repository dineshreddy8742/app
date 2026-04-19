import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth';
import { api } from '../../src/api';
import { colors, fonts, radius, spacing, brutalShadow, softShadow } from '../../src/theme';

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.dashboard();
      setData(d);
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.screen, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greet}>Hello,</Text>
            <Text style={styles.name} testID="dashboard-user-name">{user?.name}</Text>
          </View>
          <View style={[styles.avatar, { backgroundColor: roleColor(user?.role) }]}>
            <Feather name={roleIcon(user?.role)} size={22} color={colors.textPrimary} />
          </View>
        </View>

        <View style={[styles.roleTag, { backgroundColor: roleColor(user?.role), borderColor: roleBorder(user?.role) }]}>
          <Text style={styles.roleTagText}>{(user?.role || '').toUpperCase()}</Text>
        </View>

        {data?.role === 'admin' && <AdminView data={data} />}
        {data?.role === 'teacher' && <TeacherView data={data} onMark={() => router.push('/(tabs)/attendance')} />}
        {data?.role === 'student' && <StudentView data={data} />}
        {data?.role === 'parent' && <ParentView data={data} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function roleColor(role?: string) {
  if (role === 'admin') return colors.primaryLight;
  if (role === 'teacher') return colors.mint;
  if (role === 'student') return colors.peach;
  if (role === 'parent') return colors.lavender;
  return colors.primaryLight;
}
function roleBorder(role?: string) {
  if (role === 'admin') return colors.primary;
  if (role === 'teacher') return colors.mintBorder;
  if (role === 'student') return colors.peachBorder;
  if (role === 'parent') return colors.lavenderBorder;
  return colors.primary;
}
function roleIcon(role?: string): any {
  if (role === 'admin') return 'shield';
  if (role === 'teacher') return 'clipboard';
  if (role === 'student') return 'book';
  if (role === 'parent') return 'heart';
  return 'user';
}

function AdminView({ data }: any) {
  const m = data.metrics;
  return (
    <View>
      <Text style={styles.sectionHeading}>Overview</Text>
      <View style={styles.grid2}>
        <Metric label="Students" value={m.total_students} color={colors.primaryLight} border={colors.primary} icon="users" />
        <Metric label="Teachers" value={m.total_teachers} color={colors.mint} border={colors.mintBorder} icon="briefcase" />
        <Metric label="Classes" value={m.total_classes} color={colors.peach} border={colors.peachBorder} icon="grid" />
        <Metric label="Attendance" value={`${m.attendance_today_pct}%`} color={colors.lavender} border={colors.lavenderBorder} icon="check-circle" />
      </View>

      <Text style={styles.sectionHeading}>Fees</Text>
      <View style={styles.bigCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={styles.bigLabel}>Total Collected</Text>
            <Text style={styles.bigValue} testID="admin-fees-collected">${m.collected_fees.toFixed(0)}</Text>
          </View>
          <Feather name="trending-up" size={28} color={colors.mintBorder} />
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, {
            width: `${m.total_fees ? Math.min(100, (m.collected_fees / m.total_fees) * 100) : 0}%`
          }]} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
          <Text style={styles.smallMeta}>Pending: ${m.pending_fees.toFixed(0)}</Text>
          <Text style={styles.smallMeta}>Total: ${m.total_fees.toFixed(0)}</Text>
        </View>
      </View>
    </View>
  );
}

function TeacherView({ data, onMark }: any) {
  return (
    <View>
      <TouchableOpacity style={styles.ctaCard} onPress={onMark} testID="cta-mark-attendance">
        <View style={{ flex: 1 }}>
          <Text style={styles.ctaKicker}>Quick Action</Text>
          <Text style={styles.ctaTitle}>Mark Today&apos;s Attendance</Text>
          <Text style={styles.ctaSub}>Tap to open class list</Text>
        </View>
        <Feather name="arrow-right" size={28} color={colors.white} />
      </TouchableOpacity>

      <Text style={styles.sectionHeading}>Today&apos;s Classes</Text>
      {data.today_classes?.length ? data.today_classes.map((c: any) => (
        <View key={c.id} style={styles.timeCard}>
          <View style={styles.timePill}><Text style={styles.timePillText}>{c.time}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.timeSubject}>{c.subject}</Text>
            <Text style={styles.timeMeta}>{c.class_name} • Period {c.period}</Text>
          </View>
        </View>
      )) : (
        <EmptyState text="No classes scheduled today 🎉" />
      )}

      <Text style={styles.sectionHeading}>My Classes</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {data.assigned_classes?.map((c: string) => (
          <View key={c} style={styles.chip}><Text style={styles.chipText}>{c}</Text></View>
        ))}
      </View>
    </View>
  );
}

function StudentView({ data }: any) {
  if (!data.student) return <EmptyState text="No student profile linked" />;
  return (
    <View>
      <View style={styles.grid2}>
        <Metric label="Attendance" value={`${data.attendance_pct}%`} color={colors.mint} border={colors.mintBorder} icon="check-circle" testID="student-attendance-metric" />
        <Metric label="Fees Due" value={`$${(data.fees_due || 0).toFixed(0)}`} color={data.fees_due > 0 ? colors.coral : colors.mint} border={data.fees_due > 0 ? colors.coralBorder : colors.mintBorder} icon="credit-card" testID="student-fees-metric" />
      </View>

      <Text style={styles.sectionHeading}>Today&apos;s Classes</Text>
      {data.today_classes?.length ? data.today_classes.map((c: any) => (
        <View key={c.id} style={styles.timeCard}>
          <View style={styles.timePill}><Text style={styles.timePillText}>{c.time}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.timeSubject}>{c.subject}</Text>
            <Text style={styles.timeMeta}>{c.teacher_name}</Text>
          </View>
        </View>
      )) : (
        <EmptyState text="Enjoy your day off!" />
      )}

      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>Class</Text>
        <Text style={styles.infoValue}>{data.student.class_name}</Text>
        <Text style={styles.infoLabel}>Roll No</Text>
        <Text style={styles.infoValue}>{data.student.roll_no}</Text>
      </View>
    </View>
  );
}

function ParentView({ data }: any) {
  if (!data.children?.length) return <EmptyState text="No children linked to this account" />;
  return (
    <View>
      <Text style={styles.sectionHeading}>Your Children</Text>
      {data.children.map((c: any) => (
        <View key={c.id} style={styles.childCard} testID={`child-card-${c.id}`}>
          <View style={[styles.childAvatar, { backgroundColor: colors.lavender }]}>
            <Text style={styles.childInitial}>{c.name[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.childName}>{c.name}</Text>
            <Text style={styles.childMeta}>{c.class_name} • Roll {c.roll_no}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <View style={[styles.miniPill, { backgroundColor: colors.mint, borderColor: colors.mintBorder }]}>
                <Text style={styles.miniPillText}>{c.attendance_pct}% present</Text>
              </View>
              {c.fees_due > 0 && (
                <View style={[styles.miniPill, { backgroundColor: colors.coral, borderColor: colors.coralBorder }]}>
                  <Text style={styles.miniPillText}>${c.fees_due.toFixed(0)} due</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function Metric({ label, value, color, border, icon, testID }: any) {
  return (
    <View style={[styles.metricCard, { backgroundColor: color, borderColor: border }]} testID={testID}>
      <Feather name={icon} size={18} color={colors.textPrimary} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Feather name="inbox" size={28} color={colors.textTertiary} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.appBg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greet: { fontFamily: fonts.body, fontSize: 15, color: colors.textSecondary },
  name: { fontFamily: fonts.headingExtra, fontSize: 28, color: colors.textPrimary, letterSpacing: -0.5 },
  avatar: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.borderDefault,
    justifyContent: 'center', alignItems: 'center', ...softShadow,
  },
  roleTag: {
    alignSelf: 'flex-start', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, marginTop: 10,
  },
  roleTagText: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.textPrimary, letterSpacing: 1 },
  sectionHeading: {
    fontFamily: fonts.heading, fontSize: 18, color: colors.textPrimary, marginTop: 24, marginBottom: 12,
  },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricCard: {
    width: '48%', borderRadius: radius.md, borderWidth: 1, padding: 16,
    gap: 6, ...softShadow,
  },
  metricValue: { fontFamily: fonts.headingExtra, fontSize: 24, color: colors.textPrimary },
  metricLabel: { fontFamily: fonts.bodyMed, fontSize: 13, color: colors.textSecondary },
  bigCard: {
    backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.borderDefault, padding: 20, ...brutalShadow,
  },
  bigLabel: { fontFamily: fonts.bodyMed, fontSize: 13, color: colors.textSecondary },
  bigValue: { fontFamily: fonts.headingExtra, fontSize: 30, color: colors.textPrimary, marginTop: 2 },
  progressBar: {
    marginTop: 16, height: 10, backgroundColor: colors.primaryLight,
    borderRadius: 999, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderDefault,
  },
  progressFill: { height: '100%', backgroundColor: colors.primary },
  smallMeta: { fontFamily: fonts.bodyMed, fontSize: 12, color: colors.textSecondary },
  ctaCard: {
    marginTop: 20, backgroundColor: colors.textPrimary,
    borderRadius: radius.md, padding: 20, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: colors.borderDefault, ...brutalShadow,
  },
  ctaKicker: { fontFamily: fonts.bodyMed, fontSize: 12, color: colors.textTertiary, letterSpacing: 1 },
  ctaTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.white, marginTop: 4 },
  ctaSub: { fontFamily: fonts.body, fontSize: 13, color: colors.textTertiary, marginTop: 2 },
  timeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.borderDefault, padding: 14, marginBottom: 10, ...softShadow,
  },
  timePill: {
    backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, minWidth: 96, alignItems: 'center',
  },
  timePillText: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.primaryDark },
  timeSubject: { fontFamily: fonts.heading, fontSize: 15, color: colors.textPrimary },
  timeMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  chip: {
    backgroundColor: colors.mint, borderWidth: 1, borderColor: colors.mintBorder,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
  },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.mintText },
  infoCard: {
    marginTop: 16, backgroundColor: colors.white, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.borderDefault, padding: 16, ...softShadow,
  },
  infoLabel: { fontFamily: fonts.bodyMed, fontSize: 12, color: colors.textSecondary },
  infoValue: { fontFamily: fonts.heading, fontSize: 16, color: colors.textPrimary, marginBottom: 8 },
  childCard: {
    flexDirection: 'row', gap: 12, backgroundColor: colors.white,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderDefault,
    padding: 14, marginBottom: 12, ...softShadow,
  },
  childAvatar: {
    width: 54, height: 54, borderRadius: 27, borderWidth: 1, borderColor: colors.borderDefault,
    justifyContent: 'center', alignItems: 'center',
  },
  childInitial: { fontFamily: fonts.headingExtra, fontSize: 20, color: colors.textPrimary },
  childName: { fontFamily: fonts.heading, fontSize: 16, color: colors.textPrimary },
  childMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  miniPill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1,
  },
  miniPillText: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.textPrimary },
  empty: {
    padding: 24, alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  emptyText: { fontFamily: fonts.bodyMed, fontSize: 14, color: colors.textSecondary, marginTop: 8 },
});
