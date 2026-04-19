# Scholara — School Management System (Mobile)

## Overview
Mobile-first React Native Expo application for multi-role school management.
Backend: FastAPI + MongoDB with JWT auth, bcrypt password hashing, seeded demo data.

## Roles
- **Admin**: School analytics, student/teacher management, fee oversight, announcements, leave approvals
- **Teacher**: Today's classes, mark attendance (Present/Absent/Late toggle), my classes
- **Student**: Attendance %, fees due, today's timetable, exam results, apply leave
- **Parent**: Children overview (attendance, fees due), notifications

## Features Implemented (MVP)
- Role-based JWT authentication with session persistence (AsyncStorage)
- 4 demo login shortcuts on the sign-in screen
- Role-specific dashboards with metrics (Admin) / today's classes (Teacher) / attendance % & timetable (Student) / children summary (Parent)
- One-tap class-wise attendance marking (Present/Absent/Late) + bulk actions
- Student history view with attendance % for students
- Students list with search (role-scoped: parent sees only their children)
- Fees tracking with payment action (pay full), payment history
- Timetable per class & per day
- Exams & Results (grade badges)
- Notifications inbox with unread indicators; Admin can broadcast announcements
- Leave management (apply + admin approve/reject)
- Teachers directory (Admin)
- Bottom tab navigation adapts per role; "More" hub links to secondary screens
- Neo-brutalist design (Outfit/Manrope fonts, solid borders, pastel accents) per design_guidelines.json

## API Surface (all prefixed `/api`)
- `POST /auth/login`, `GET /auth/me`
- `GET /dashboard` (role-aware)
- `GET /students`, `POST /students`, `GET /students/{id}`
- `GET /teachers`, `GET /classes`
- `GET /attendance`, `POST /attendance/mark`
- `GET /fees`, `POST /fees/pay`, `GET /payments`
- `GET /timetable`, `GET /exams`, `GET /results`
- `GET /notifications`, `POST /notifications`, `POST /notifications/{id}/read`
- `GET /leaves`, `POST /leaves`, `POST /leaves/{id}/approve|reject`

## Tech
- Frontend: Expo SDK 54, expo-router, @expo/vector-icons (Feather), Google Fonts (Outfit, Manrope), AsyncStorage
- Backend: FastAPI, Motor (MongoDB async), bcrypt, PyJWT

## Demo Accounts
See `/app/memory/test_credentials.md`.

## Deferred (not in MVP, per user's "proceed with defaults")
- Expo Push notifications, QR-based attendance, face recognition, WhatsApp, AI insights
- Next.js web admin panel
- Multi-tenant (SaaS) isolation
- Supabase backend (replaced by FastAPI+MongoDB per default)
