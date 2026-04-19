import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { api } from '../src/api';
import { colors, fonts, radius, spacing, softShadow } from '../src/theme';

const TYPE_COLORS: Record<string, { bg: string; border: string }> = {
  announcement: { bg: colors.primaryLight, border: colors.primary },
  fee: { bg: colors.coral, border: colors.coralBorder },
  attendance: { bg: colors.mint, border: colors.mintBorder },
  general: { bg: colors.peach, border: colors.peachBorder },
};

export default function Notifications() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const n: any = await api.notifications();
        setItems(n);
      } finally { setLoading(false); }
    })();
  }, []);

  const toggleRead = async (id: string) => {
    await api.markNotifRead(id);
    setItems((it) => it.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="notif-back">
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 60 }}>
        {loading ? <ActivityIndicator color={colors.primary} /> : items.length === 0 ? (
          <Text style={styles.meta}>No notifications yet.</Text>
        ) : items.map((n) => {
          const c = TYPE_COLORS[n.type] || TYPE_COLORS.general;
          return (
            <TouchableOpacity
              key={n.id}
              style={[styles.card, { backgroundColor: c.bg, borderColor: c.border }, n.is_read && { opacity: 0.7 }]}
              onPress={() => toggleRead(n.id)}
              testID={`notif-${n.id}`}
            >
              <View style={styles.typeRow}>
                <Text style={styles.type}>{n.type.toUpperCase()}</Text>
                {!n.is_read && <View style={styles.dot} />}
              </View>
              <Text style={styles.titleCard}>{n.title}</Text>
              <Text style={styles.body}>{n.message}</Text>
              <Text style={styles.time}>{new Date(n.created_at).toLocaleString()}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.appBg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screen, paddingVertical: 12 },
  title: { fontFamily: fonts.heading, fontSize: 18, color: colors.textPrimary },
  card: {
    borderRadius: radius.md, borderWidth: 1, padding: 16, marginBottom: 12, ...softShadow,
  },
  typeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  type: { fontFamily: fonts.bodySemi, fontSize: 10, color: colors.textPrimary, letterSpacing: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coralBorder },
  titleCard: { fontFamily: fonts.heading, fontSize: 16, color: colors.textPrimary, marginTop: 6 },
  body: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  time: { fontFamily: fonts.body, fontSize: 11, color: colors.textTertiary, marginTop: 8 },
  meta: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary },
});
