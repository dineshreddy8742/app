import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/auth';
import { api } from '../../src/api';
import { colors, fonts, radius, spacing, softShadow } from '../../src/theme';

type Item = { icon: any; label: string; to?: any; color: string; border: string; badge?: number };

export default function More() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const pollRef = useRef<any>(null);

  const loadUnread = async () => {
    try {
      const r: any = await api.unreadCount();
      setUnread(r.count || 0);
    } catch {}
  };

  useEffect(() => {
    loadUnread();
    pollRef.current = setInterval(loadUnread, 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const items: Item[] = [
    { icon: 'bell', label: 'Notifications', to: '/notifications', color: colors.lavender, border: colors.lavenderBorder, badge: unread },
    { icon: 'book-open', label: 'Study Materials', to: '/materials', color: colors.mint, border: colors.mintBorder },
    { icon: 'award', label: 'Exams & Results', to: '/results', color: colors.peach, border: colors.peachBorder },
    { icon: 'file-text', label: 'Leave Requests', to: '/leaves', color: colors.mint, border: colors.mintBorder },
  ];
  if (user?.role === 'admin') {
    items.push({ icon: 'briefcase', label: 'Teachers', to: '/teachers', color: colors.primaryLight, border: colors.primary });
  }
  if (user?.role === 'admin' || user?.role === 'teacher') {
    items.push({ icon: 'edit-3', label: 'Publish Results', to: '/publish-results', color: colors.peach, border: colors.peachBorder });
    items.push({ icon: 'send', label: 'Send Announcement', to: '/announce', color: colors.warning, border: colors.warningBorder });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 100 }}>
        <Text style={styles.h1}>More</Text>

        <View style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
            <Text style={styles.avatarText}>{user?.name?.[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.meta}>{user?.email}</Text>
            <View style={[styles.rolePill, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
              <Text style={styles.rolePillText}>{user?.role?.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionHeading}>Quick Access</Text>
        {items.map((it) => (
          <TouchableOpacity
            key={it.label}
            testID={`more-${it.label.replace(/\s+/g, '-').toLowerCase()}`}
            onPress={() => it.to && router.push(it.to)}
            style={styles.row}
            activeOpacity={0.8}
          >
            <View style={[styles.iconBox, { backgroundColor: it.color, borderColor: it.border }]}>
              <Feather name={it.icon} size={18} color={colors.textPrimary} />
            </View>
            <Text style={styles.rowLabel}>{it.label}</Text>
            {it.badge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{it.badge > 99 ? '99+' : it.badge}</Text>
              </View>
            ) : null}
            <Feather name="chevron-right" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          testID="logout-btn"
          style={[styles.row, { marginTop: 24, borderColor: colors.coralBorder, backgroundColor: colors.coral }]}
          onPress={() => {
            if (Platform.OS === 'web') {
              logout();
            } else {
              Alert.alert('Sign out', 'Are you sure?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign out', style: 'destructive', onPress: () => { logout(); } },
              ]);
            }
          }}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.white, borderColor: colors.coralBorder }]}>
            <Feather name="log-out" size={18} color={colors.coralBorder} />
          </View>
          <Text style={[styles.rowLabel, { color: colors.coralText }]}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.appBg },
  h1: { fontFamily: fonts.headingExtra, fontSize: 28, color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 16 },
  profileCard: {
    flexDirection: 'row', gap: 12, backgroundColor: colors.white,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderDefault,
    padding: 16, alignItems: 'center', ...softShadow,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: colors.borderDefault, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontFamily: fonts.headingExtra, fontSize: 22, color: colors.textPrimary },
  name: { fontFamily: fonts.heading, fontSize: 18, color: colors.textPrimary },
  meta: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  rolePill: {
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1,
    borderRadius: 999, marginTop: 6,
  },
  rolePillText: { fontFamily: fonts.bodySemi, fontSize: 10, color: colors.textPrimary, letterSpacing: 1 },
  sectionHeading: { fontFamily: fonts.heading, fontSize: 16, color: colors.textPrimary, marginTop: 24, marginBottom: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.borderDefault, padding: 14, marginBottom: 10, ...softShadow,
  },
  iconBox: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { flex: 1, fontFamily: fonts.headingSemi, fontSize: 15, color: colors.textPrimary },
  badge: {
    minWidth: 24, height: 24, borderRadius: 12, backgroundColor: colors.coralBorder,
    paddingHorizontal: 7, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.borderDefault,
  },
  badgeText: { color: colors.white, fontFamily: fonts.headingSemi, fontSize: 11 },
});
