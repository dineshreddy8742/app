import React from 'react';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { View, StyleSheet, Platform } from 'react-native';
import { useAuth } from '../../src/auth';
import { colors, fonts } from '../../src/theme';

export default function TabsLayout() {
  const { user } = useAuth();
  const role = user?.role || 'student';

  const tabBarStyle = {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
    height: Platform.OS === 'ios' ? 88 : 72,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
  };

  const iconWithPill = (name: any, focused: boolean) => (
    <View style={[styles.iconPill, focused && styles.iconPillActive]}>
      <Feather name={name} size={20} color={focused ? colors.primaryDark : colors.textTertiary} />
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: { fontFamily: fonts.bodySemi, fontSize: 11, marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => iconWithPill('home', focused),
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ focused }) => iconWithPill('check-square', focused),
          href: role === 'parent' ? null : '/(tabs)/attendance',
        }}
      />
      <Tabs.Screen
        name="students"
        options={{
          title: role === 'parent' ? 'Children' : 'Students',
          tabBarIcon: ({ focused }) => iconWithPill('users', focused),
          href: role === 'student' ? null : '/(tabs)/students',
        }}
      />
      <Tabs.Screen
        name="fees"
        options={{
          title: 'Fees',
          tabBarIcon: ({ focused }) => iconWithPill('credit-card', focused),
          href: role === 'teacher' ? null : '/(tabs)/fees',
        }}
      />
      <Tabs.Screen
        name="timetable"
        options={{
          title: 'Timetable',
          tabBarIcon: ({ focused }) => iconWithPill('calendar', focused),
          href: role === 'admin' ? null : '/(tabs)/timetable',
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ focused }) => iconWithPill('more-horizontal', focused),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: colors.primaryLight,
  },
});
