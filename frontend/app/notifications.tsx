import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Platform,
} from 'react-native';
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
  circular: { bg: colors.warning, border: colors.warningBorder },
  result: { bg: colors.lavender, border: colors.lavenderBorder },
  meeting: { bg: colors.primaryLight, border: colors.primary },
};

export default function Notifications() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<any>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const n: any = await api.notifications();
      setItems(n);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 15000); // 15s near-realtime
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  const openRead = async (n: any) => {
    if (!n.is_read) {
      await api.markNotifRead(n.id);
      setItems((it) => it.map((x) => x.id === n.id ? { ...x, is_read: true } : x));
    }
  };

  const open = async (url: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank');
    } else {
      await Linking.openURL(url);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="notif-back">
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <TouchableOpacity onPress={load} testID="notif-refresh">
          <Feather name="refresh-cw" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 60 }}>
        {loading ? <ActivityIndicator color={colors.primary} /> : items.length === 0 ? (
          <Text style={styles.meta}>No notifications yet.</Text>
        ) : items.map((n) => {
          const c = TYPE_COLORS[n.type] || TYPE_COLORS.general;
          return (
            <TouchableOpacity
              key={n.id}
              style={[styles.card, { backgroundColor: c.bg, borderColor: c.border }, n.is_read && { opacity: 0.65 }]}
              onPress={() => openRead(n)}
              testID={`notif-${n.id}`}
              activeOpacity={0.85}
            >
              <View style={styles.typeRow}>
                <Text style={styles.type}>{n.type.toUpperCase()}</Text>
                {!n.is_read && <View style={styles.dot} />}
              </View>
              <Text style={styles.titleCard}>{n.title}</Text>
              <Text style={styles.body}>{n.message}</Text>
              {n.attachment_url ? (
                <TouchableOpacity style={styles.linkBtn} onPress={() => open(n.attachment_url)} testID={`attach-${n.id}`}>
                  <Feather name="paperclip" size={14} color={colors.primaryDark} />
                  <Text style={styles.linkText}>{n.attachment_name || 'Open attachment'}</Text>
                </TouchableOpacity>
              ) : null}
              {n.meeting_url ? (
                <TouchableOpacity style={[styles.linkBtn, { backgroundColor: colors.primary, borderColor: colors.borderDefault }]} onPress={() => open(n.meeting_url)} testID={`meet-${n.id}`}>
                  <Feather name="video" size={14} color={colors.white} />
                  <Text style={[styles.linkText, { color: colors.white }]}>Join Meeting</Text>
                </TouchableOpacity>
              ) : null}
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
  card: { borderRadius: radius.md, borderWidth: 1, padding: 16, marginBottom: 12, ...softShadow },
  typeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  type: { fontFamily: fonts.bodySemi, fontSize: 10, color: colors.textPrimary, letterSpacing: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coralBorder },
  titleCard: { fontFamily: fonts.heading, fontSize: 16, color: colors.textPrimary, marginTop: 6 },
  body: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  linkBtn: {
    flexDirection: 'row', gap: 6, alignSelf: 'flex-start', marginTop: 10,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.primary,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, alignItems: 'center',
  },
  linkText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.primaryDark },
  time: { fontFamily: fonts.body, fontSize: 11, color: colors.textTertiary, marginTop: 8 },
  meta: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary },
});
