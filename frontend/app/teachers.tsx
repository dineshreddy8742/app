import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { api } from '../src/api';
import { colors, fonts, radius, spacing, softShadow } from '../src/theme';

export default function Teachers() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try { setItems(await api.teachers() as any[]); } finally { setLoading(false); }
    })();
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Teachers</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 60 }}>
        {loading ? <ActivityIndicator color={colors.primary} /> : items.map((t) => (
          <View key={t.id} style={styles.card}>
            <View style={[styles.avatar, { backgroundColor: colors.mint, borderColor: colors.mintBorder }]}>
              <Text style={styles.avatarText}>{t.name[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{t.name}</Text>
              <Text style={styles.meta}>{t.subject}</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                {(t.classes || []).map((c: string) => (
                  <View key={c} style={styles.chip}><Text style={styles.chipText}>{c}</Text></View>
                ))}
              </View>
            </View>
          </View>
        ))}
        {!loading && items.length === 0 && <Text style={styles.empty}>No teachers yet.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.appBg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screen, paddingVertical: 12 },
  title: { fontFamily: fonts.heading, fontSize: 18, color: colors.textPrimary },
  card: { flexDirection: 'row', gap: 12, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderDefault, padding: 14, marginBottom: 10, ...softShadow },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontFamily: fonts.headingExtra, fontSize: 18, color: colors.textPrimary },
  name: { fontFamily: fonts.heading, fontSize: 16, color: colors.textPrimary },
  meta: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  chip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primaryLight },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.primaryDark },
  empty: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 32 },
});
