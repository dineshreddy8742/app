import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

export type Role = 'admin' | 'teacher' | 'student' | 'parent';

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string | null;
  phone?: string | null;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          const me = await api.me();
          setUser(me as User);
        }
      } catch {
        await AsyncStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    await AsyncStorage.setItem('token', res.token);
    setUser(res.user as User);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem('token');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
