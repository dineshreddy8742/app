# Scholara — School Management System (Mobile)

## Overview
Mobile-first React Native Expo application for multi-role school management.
**Backend**: FastAPI + **Supabase PostgreSQL** (migrated from MongoDB) with SQLAlchemy (async) + Alembic migrations + JWT auth.

## Roles
- **Admin**: School analytics, student/teacher management, fee oversight, announcements, leave approvals
- **Teacher**: Today's classes, mark attendance (Present/Absent/Late toggle), my classes
- **Student**: Attendance %, fees due, today's timetable, exam results, apply leave
- **Parent**: Children overview (attendance, fees due), notifications

## Features Implemented (MVP)
- Role-based JWT authentication with session persistence (AsyncStorage)
- 4 demo login shortcuts on the sign-in screen
- Role-specific dashboards
- One-tap class-wise attendance marking (Present/Absent/Late) + bulk actions
- Student history view with attendance %
- Students list with search (role-scoped)
- Fees tracking with payment action, payment history
- Timetable per class & per day
- Exams & Results with grade badges
- Notifications inbox with unread indicators; Admin can broadcast announcements
- Leave management (apply + admin approve/reject)
- Teachers directory (Admin)
- Bottom tab navigation adapts per role; "More" hub links to secondary screens
- Neo-brutalist design (Outfit/Manrope fonts, solid borders, pastel accents)

## Tech Stack
- **Frontend**: Expo SDK 54, expo-router, @expo/vector-icons (Feather), Google Fonts (Outfit, Manrope), AsyncStorage
- **Backend**: FastAPI, SQLAlchemy async, asyncpg, Alembic, bcrypt, PyJWT
- **Database**: Supabase PostgreSQL (Transaction Pooler)
- All Scholara tables prefixed `sch_` so they don't collide with other projects in the shared Supabase instance

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

## Database
- Connection: Supabase Transaction Pooler (port 6543) via `DATABASE_URL` in `/app/backend/.env`
- Migrations: Alembic in `/app/backend/alembic/versions/`
- Tables: `sch_users`, `sch_classes`, `sch_students`, `sch_teachers`, `sch_attendance`, `sch_fees`, `sch_payments`, `sch_timetable`, `sch_exams`, `sch_results`, `sch_notifications`, `sch_leaves`
- Seeding: On first startup creates 14 users, 10 students, 2 teachers, 3 classes, timetable, exams, results, notifications, and 14 days of attendance.

## Demo Accounts
See `/app/memory/test_credentials.md`.

## Mobile Build (EAS)
`/app/frontend/eas.json` is configured. To produce an APK:
```bash
cd /app/frontend
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

## GitHub Push & Deploy (Emergent platform features)
- **Save to GitHub**: use the button in the Emergent workspace header — handles repo creation + push
- **Deploy backend**: Emergent "Deploy" button (~50 credits/month, 10–15 min)
- **Mobile deploy**: use Expo EAS Build + `eas submit` (Emergent does not publish to Play/App Store)

## Deferred
- Supabase Auth (currently using custom JWT — simpler and already working)
- RLS policies (not needed while using service-role from backend; add if switching to client-direct access)
- Next.js web admin panel
- Expo push notifications, QR attendance, face recognition, WhatsApp, AI insights
- Multi-tenant (tenant_id per school)
