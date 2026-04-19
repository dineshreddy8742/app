import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../src/auth';
import { api } from '../../src/api';
import { colors, fonts, radius, spacing, softShadow } from '../../src/theme';

export default function Students() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const list: any = await api.students();
        setItems(list);
      } finally { setLoading(false); }
    })();
  }, []);

  const filtered = items.filter((s) => {
    if (!q) return true;
    const k = q.toLowerCase();
    return s.name.toLowerCase().includes(k) || s.roll_no.toLowerCase().includes(k) || s.class_name.toLowerCase().includes(k);
  });

  const title = user?.role === 'parent' ? 'My Children' : 'Students';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 100 }}>
        <Text style={styles.h1}>{title}</Text>
        <Text style={styles.sub}>{items.length} total</Text>

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
              <Text style={styles.meta}>Class {s.class_name} • Roll {s.roll_no}</Text>
              {s.phone && <Text style={styles.metaSm}>{s.phone}</Text>}
            </View>
            <Feather name="chevron-right" size={20} color={colors.textTertiary} />
          </View>
        ))}
        {!loading && filtered.length === 0 && (
          <View style={styles.empty}>
            <Feather name="users" size={32} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No students found</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.appBg },
  h1: { fontFamily: fonts.headingExtra, fontSize: 28, color: colors.textPrimary, letterSpacing: -0.5 },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
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
  avatar: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontFamily: fonts.headingExtra, fontSize: 18, color: colors.textPrimary },
  name: { fontFamily: fonts.heading, fontSize: 16, color: colors.textPrimary },
  meta: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  metaSm: { fontFamily: fonts.body, fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  empty: {
    marginTop: 32, padding: 32, alignItems: 'center', backgroundColor: colors.white,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSubtle,
  },
  emptyText: { fontFamily: fonts.bodyMed, fontSize: 14, color: colors.textSecondary, marginTop: 8 },
});
