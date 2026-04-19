import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

async function authHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem('token');
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function apiRequest<T = any>(
  path: string,
  method: Method = 'GET',
  body?: any
): Promise<T> {
  const url = `${BASE}/api${path}`;
  const headers = await authHeaders();
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { detail: text };
  }
  if (!res.ok) {
    throw new Error(data?.detail || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    apiRequest<{ token: string; user: any }>('/auth/login', 'POST', { email, password }),
  me: () => apiRequest('/auth/me'),
  dashboard: () => apiRequest('/dashboard'),
  students: (className?: string) =>
    apiRequest(`/students${className ? `?class_name=${encodeURIComponent(className)}` : ''}`),
  teachers: () => apiRequest('/teachers'),
  classes: () => apiRequest('/classes'),
  attendance: (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/attendance${q ? '?' + q : ''}`);
  },
  markAttendance: (className: string, date: string, records: any[]) =>
    apiRequest('/attendance/mark', 'POST', { class_name: className, date, records }),
  fees: (studentId?: string) =>
    apiRequest(`/fees${studentId ? `?student_id=${studentId}` : ''}`),
  payFee: (feeId: string, amount: number) =>
    apiRequest('/fees/pay', 'POST', { fee_id: feeId, amount }),
  payments: (studentId?: string) =>
    apiRequest(`/payments${studentId ? `?student_id=${studentId}` : ''}`),
  timetable: (className?: string) =>
    apiRequest(`/timetable${className ? `?class_name=${encodeURIComponent(className)}` : ''}`),
  exams: () => apiRequest('/exams'),
  results: (studentId?: string) =>
    apiRequest(`/results${studentId ? `?student_id=${studentId}` : ''}`),
  notifications: () => apiRequest('/notifications'),
  markNotifRead: (id: string) => apiRequest(`/notifications/${id}/read`, 'POST'),
  createNotif: (data: any) => apiRequest('/notifications', 'POST', data),
  leaves: () => apiRequest('/leaves'),
  applyLeave: (data: any) => apiRequest('/leaves', 'POST', data),
  approveLeave: (id: string) => apiRequest(`/leaves/${id}/approve`, 'POST'),
  rejectLeave: (id: string) => apiRequest(`/leaves/${id}/reject`, 'POST'),
  createStudent: (data: any) => apiRequest('/students', 'POST', data),
};
