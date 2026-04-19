import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/auth';
import { colors } from '../src/theme';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) router.replace('/(tabs)');
    else router.replace('/login');
  }, [user, loading]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.appBg }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
