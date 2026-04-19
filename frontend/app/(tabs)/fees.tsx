import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { api } from '../../src/api';
import { colors, fonts, radius, spacing, softShadow, brutalShadow } from '../../src/theme';

export default function Fees() {
  const [loading, setLoading] = useState(true);
  const [fees, setFees] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [studentNames, setStudentNames] = useState<Record<string, string>>({});
  const [payingId, setPayingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [f, p, s] = await Promise.all([api.fees(), api.payments(), api.students()]);
      setFees(f as any[]);
      setPayments(p as any[]);
      const map: Record<string, string> = {};
      (s as any[]).forEach((st) => { map[st.id] = `${st.name} (${st.class_name})`; });
      setStudentNames(map);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const payFull = async (fee: any) => {
    setPayingId(fee.id);
    try {
      const remaining = fee.amount - (fee.paid || 0);
      await api.payFee(fee.id, remaining);
      await load();
      Alert.alert('Payment Successful', `Paid $${remaining.toFixed(0)} for ${fee.term}`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally { setPayingId(null); }
  };

  const totalDue = fees.reduce((s, f) => s + (f.amount - (f.paid || 0)), 0);
  const totalPaid = fees.reduce((s, f) => s + (f.paid || 0), 0);

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 100 }}>
        <Text style={styles.h1}>Fees</Text>
        <View style={styles.summary}>
          <View style={[styles.sumCard, { backgroundColor: colors.mint, borderColor: colors.mintBorder }]}>
            <Text style={styles.sumLabel}>Paid</Text>
            <Text style={styles.sumValue} testID="fees-paid-total">${totalPaid.toFixed(0)}</Text>
          </View>
          <View style={[styles.sumCard, { backgroundColor: totalDue > 0 ? colors.coral : colors.mint, borderColor: totalDue > 0 ? colors.coralBorder : colors.mintBorder }]}>
            <Text style={styles.sumLabel}>Due</Text>
            <Text style={styles.sumValue} testID="fees-due-total">${totalDue.toFixed(0)}</Text>
          </View>
        </View>

        <Text style={styles.sectionHeading}>Fee Records</Text>
        {fees.map((f) => {
          const remaining = f.amount - (f.paid || 0);
          const paid = remaining <= 0;
          return (
            <View key={f.id} style={styles.feeCard} testID={`fee-card-${f.id}`}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.feeTerm}>{f.term}</Text>
                  {studentNames[f.student_id] && (
                    <Text style={styles.feeStudent}>{studentNames[f.student_id]}</Text>
                  )}
                  <Text style={styles.feeDue}>Due {f.due_date}</Text>
                </View>
                <View style={[styles.statusBadge, paid ? { backgroundColor: colors.mint, borderColor: colors.mintBorder } : { backgroundColor: colors.warning, borderColor: colors.warningBorder }]}>
                  <Text style={styles.statusText}>{paid ? 'PAID' : 'PENDING'}</Text>
                </View>
              </View>
              <View style={styles.feeAmountRow}>
                <Text style={styles.feeAmount}>${f.amount.toFixed(0)}</Text>
                {!paid && (
                  <TouchableOpacity
                    testID={`pay-fee-${f.id}`}
                    style={styles.payBtn}
                    onPress={() => payFull(f)}
                    disabled={payingId === f.id}
                  >
                    {payingId === f.id ? <ActivityIndicator color={colors.white} size="small" /> : (
                      <>
                        <Feather name="credit-card" size={14} color={colors.white} />
                        <Text style={styles.payText}>Pay ${remaining.toFixed(0)}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        <Text style={styles.sectionHeading}>Payment History</Text>
        {payments.length === 0 && <Text style={styles.meta}>No payments yet.</Text>}
        {payments.map((p) => (
          <View key={p.id} style={styles.payRow} testID={`payment-${p.id}`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.payName}>${p.amount.toFixed(0)} · {p.method}</Text>
              <Text style={styles.meta}>{new Date(p.paid_at).toLocaleDateString()}</Text>
            </View>
            <Feather name="check-circle" size={18} color={colors.mintBorder} />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.appBg },
  h1: { fontFamily: fonts.headingExtra, fontSize: 28, color: colors.textPrimary, letterSpacing: -0.5 },
  summary: { flexDirection: 'row', gap: 12, marginTop: 16 },
  sumCard: { flex: 1, padding: 16, borderRadius: radius.md, borderWidth: 1, ...softShadow },
  sumLabel: { fontFamily: fonts.bodyMed, fontSize: 12, color: colors.textSecondary },
  sumValue: { fontFamily: fonts.headingExtra, fontSize: 24, color: colors.textPrimary, marginTop: 2 },
  sectionHeading: { fontFamily: fonts.heading, fontSize: 18, color: colors.textPrimary, marginTop: 24, marginBottom: 12 },
  feeCard: {
    backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.borderDefault, padding: 16, marginBottom: 12, ...softShadow,
  },
  feeTerm: { fontFamily: fonts.heading, fontSize: 16, color: colors.textPrimary },
  feeStudent: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  feeDue: { fontFamily: fonts.body, fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, alignSelf: 'flex-start' },
  statusText: { fontFamily: fonts.bodySemi, fontSize: 10, color: colors.textPrimary },
  feeAmountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  feeAmount: { fontFamily: fonts.headingExtra, fontSize: 22, color: colors.textPrimary },
  payBtn: {
    flexDirection: 'row', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1, borderColor: colors.borderDefault, alignItems: 'center', ...softShadow,
  },
  payText: { color: colors.white, fontFamily: fonts.headingSemi, fontSize: 13 },
  payRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.borderSubtle, padding: 12, marginBottom: 8,
  },
  payName: { fontFamily: fonts.headingSemi, fontSize: 15, color: colors.textPrimary },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
