from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import random

from database import engine, AsyncSessionLocal, get_db
from models import (
    Base, User, SchoolClass, Student, Teacher, Attendance, Fee, Payment,
    TimetableSlot, Exam, Result, Notification, Leave,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Auth
JWT_SECRET = os.environ.get('JWT_SECRET', 'scholara-secret-change-me')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRE_DAYS = 30

security = HTTPBearer()

app = FastAPI(title="Scholara - School Management System API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------- Helpers ----------
def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False


def create_token(user_id: str, role: str) -> str:
    return jwt.encode(
        {"sub": user_id, "role": role,
         "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS)},
        JWT_SECRET, algorithm=JWT_ALGORITHM,
    )


def user_to_dict(u: User) -> dict:
    return {
        "id": u.id, "name": u.name, "email": u.email, "role": u.role,
        "avatar": u.avatar, "phone": u.phone, "created_at": u.created_at,
    }


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

    uid = payload.get("sub")
    res = await db.execute(select(User).where(User.id == uid))
    u = res.scalar_one_or_none()
    if not u:
        raise HTTPException(401, "User not found")
    return user_to_dict(u)


def require_role(*roles: str):
    async def _dep(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "Insufficient permissions")
        return user
    return _dep


# ---------- Schemas ----------
class UserPublic(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str
    avatar: Optional[str] = None
    phone: Optional[str] = None
    created_at: datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    token: str
    user: UserPublic


class MarkAttendanceRequest(BaseModel):
    class_name: str
    date: str
    records: List[dict]


class PaymentRequest(BaseModel):
    fee_id: str
    amount: float
    method: str = "online"


class CreateNotificationRequest(BaseModel):
    title: str
    message: str
    type: Literal["announcement", "fee", "attendance", "general"] = "announcement"
    audience: str = "all"


class ApplyLeaveRequest(BaseModel):
    from_date: str
    to_date: str
    reason: str


class CreateStudentRequest(BaseModel):
    name: str
    email: EmailStr
    password: str = "student123"
    roll_no: str
    class_name: str
    section: str
    phone: Optional[str] = None
    avatar: Optional[str] = None


# ---------- Auth ----------
@api_router.post("/auth/login", response_model=LoginResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(User).where(User.email == req.email.lower()))
    u = res.scalar_one_or_none()
    if not u or not verify_password(req.password, u.password):
        raise HTTPException(401, "Invalid email or password")
    return {"token": create_token(u.id, u.role), "user": user_to_dict(u)}


@api_router.get("/auth/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return user


# ---------- Dashboard ----------
@api_router.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    role = user["role"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    if role == "admin":
        total_students = (await db.execute(select(func.count()).select_from(Student))).scalar_one()
        total_teachers = (await db.execute(select(func.count()).select_from(Teacher))).scalar_one()
        total_classes = (await db.execute(select(func.count()).select_from(SchoolClass))).scalar_one()
        fee_rows = (await db.execute(select(Fee.amount, Fee.paid))).all()
        total_fees = sum(r[0] for r in fee_rows)
        collected = sum(r[1] for r in fee_rows)
        present_today = (await db.execute(
            select(func.count()).select_from(Attendance).where(
                Attendance.date == today, Attendance.status == "present"))).scalar_one()
        total_today = (await db.execute(
            select(func.count()).select_from(Attendance).where(Attendance.date == today))).scalar_one()
        pct = round(present_today / total_today * 100, 1) if total_today else 0
        return {"role": "admin", "metrics": {
            "total_students": total_students, "total_teachers": total_teachers,
            "total_classes": total_classes, "total_fees": float(total_fees),
            "collected_fees": float(collected), "pending_fees": float(total_fees - collected),
            "attendance_today_pct": pct,
        }}

    if role == "teacher":
        t = (await db.execute(select(Teacher).where(Teacher.user_id == user["id"]))).scalar_one_or_none()
        classes = t.classes if t else []
        day_name = datetime.now(timezone.utc).strftime("%a")
        rows = (await db.execute(
            select(TimetableSlot).where(
                TimetableSlot.class_name.in_(classes), TimetableSlot.day == day_name
            ).order_by(TimetableSlot.period))).scalars().all()
        return {
            "role": "teacher",
            "teacher": {"id": t.id, "name": t.name, "email": t.email, "subject": t.subject, "classes": t.classes} if t else None,
            "today_classes": [{"id": r.id, "class_name": r.class_name, "period": r.period,
                               "subject": r.subject, "teacher_name": r.teacher_name, "time": r.time,
                               "day": r.day} for r in rows],
            "assigned_classes": classes,
        }

    if role == "student":
        s = (await db.execute(select(Student).where(Student.user_id == user["id"]))).scalar_one_or_none()
        if not s:
            return {"role": "student", "student": None}
        total = (await db.execute(select(func.count()).select_from(Attendance).where(
            Attendance.student_id == s.id))).scalar_one()
        present = (await db.execute(select(func.count()).select_from(Attendance).where(
            and_(Attendance.student_id == s.id, Attendance.status == "present")))).scalar_one()
        pct = round(present / total * 100, 1) if total else 0
        fee_rows = (await db.execute(select(Fee.amount, Fee.paid).where(Fee.student_id == s.id))).all()
        ftot = sum(r[0] for r in fee_rows)
        fpaid = sum(r[1] for r in fee_rows)
        day_name = datetime.now(timezone.utc).strftime("%a")
        rows = (await db.execute(select(TimetableSlot).where(
            and_(TimetableSlot.class_name == s.class_name, TimetableSlot.day == day_name)
        ).order_by(TimetableSlot.period))).scalars().all()
        return {
            "role": "student",
            "student": {"id": s.id, "user_id": s.user_id, "name": s.name, "email": s.email,
                        "roll_no": s.roll_no, "class_name": s.class_name, "section": s.section},
            "attendance_pct": pct,
            "fees_total": float(ftot), "fees_paid": float(fpaid), "fees_due": float(ftot - fpaid),
            "today_classes": [{"id": r.id, "class_name": r.class_name, "period": r.period,
                               "subject": r.subject, "teacher_name": r.teacher_name, "time": r.time,
                               "day": r.day} for r in rows],
        }

    if role == "parent":
        kids = (await db.execute(select(Student).where(Student.parent_id == user["id"]))).scalars().all()
        out = []
        for s in kids:
            total = (await db.execute(select(func.count()).select_from(Attendance).where(
                Attendance.student_id == s.id))).scalar_one()
            present = (await db.execute(select(func.count()).select_from(Attendance).where(
                and_(Attendance.student_id == s.id, Attendance.status == "present")))).scalar_one()
            pct = round(present / total * 100, 1) if total else 0
            fee_rows = (await db.execute(select(Fee.amount, Fee.paid).where(Fee.student_id == s.id))).all()
            ftot = sum(r[0] for r in fee_rows)
            fpaid = sum(r[1] for r in fee_rows)
            out.append({
                "id": s.id, "name": s.name, "roll_no": s.roll_no,
                "class_name": s.class_name, "section": s.section,
                "attendance_pct": pct, "fees_due": float(ftot - fpaid),
            })
        return {"role": "parent", "children": out}

    return {"role": role}


def student_to_dict(s: Student) -> dict:
    return {"id": s.id, "user_id": s.user_id, "name": s.name, "email": s.email,
            "roll_no": s.roll_no, "class_name": s.class_name, "section": s.section,
            "parent_id": s.parent_id, "avatar": s.avatar, "phone": s.phone}


# ---------- Students ----------
@api_router.get("/students")
async def list_students(class_name: Optional[str] = None, user: dict = Depends(get_current_user),
                        db: AsyncSession = Depends(get_db)):
    q = select(Student)
    if class_name:
        q = q.where(Student.class_name == class_name)
    if user["role"] == "parent":
        q = q.where(Student.parent_id == user["id"])
    rows = (await db.execute(q)).scalars().all()
    return [student_to_dict(s) for s in rows]


@api_router.get("/students/{student_id}")
async def get_student(student_id: str, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    s = (await db.execute(select(Student).where(Student.id == student_id))).scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Student not found")
    return student_to_dict(s)


@api_router.post("/students")
async def create_student(req: CreateStudentRequest, user: dict = Depends(require_role("admin")),
                         db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(select(User).where(User.email == req.email.lower()))).scalar_one_or_none()
    if existing:
        raise HTTPException(400, "Email already registered")
    u = User(name=req.name, email=req.email.lower(), password=hash_password(req.password),
             role="student", avatar=req.avatar, phone=req.phone)
    db.add(u)
    await db.flush()
    s = Student(user_id=u.id, name=req.name, email=req.email.lower(), roll_no=req.roll_no,
                class_name=req.class_name, section=req.section, avatar=req.avatar, phone=req.phone)
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return {"id": s.id, "user_id": u.id}


# ---------- Teachers ----------
@api_router.get("/teachers")
async def list_teachers(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Teacher))).scalars().all()
    return [{"id": t.id, "user_id": t.user_id, "name": t.name, "email": t.email,
             "subject": t.subject, "classes": t.classes, "avatar": t.avatar} for t in rows]


# ---------- Classes ----------
@api_router.get("/classes")
async def list_classes(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(SchoolClass))).scalars().all()
    return [{"id": c.id, "name": c.name, "grade": c.grade, "section": c.section,
             "teacher_id": c.teacher_id} for c in rows]


# ---------- Attendance ----------
@api_router.get("/attendance")
async def get_attendance(
    class_name: Optional[str] = None, student_id: Optional[str] = None,
    date_from: Optional[str] = None, date_to: Optional[str] = None,
    user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    q = select(Attendance)
    if class_name:
        q = q.where(Attendance.class_name == class_name)
    if user["role"] == "student":
        s = (await db.execute(select(Student).where(Student.user_id == user["id"]))).scalar_one_or_none()
        if s:
            q = q.where(Attendance.student_id == s.id)
    elif student_id:
        q = q.where(Attendance.student_id == student_id)
    if date_from:
        q = q.where(Attendance.date >= date_from)
    if date_to:
        q = q.where(Attendance.date <= date_to)
    rows = (await db.execute(q)).scalars().all()
    return [{"id": a.id, "student_id": a.student_id, "class_name": a.class_name,
             "date": a.date, "status": a.status, "marked_by": a.marked_by,
             "marked_at": a.marked_at} for a in rows]


@api_router.post("/attendance/mark")
async def mark_attendance(req: MarkAttendanceRequest,
                          user: dict = Depends(require_role("admin", "teacher")),
                          db: AsyncSession = Depends(get_db)):
    count = 0
    for rec in req.records:
        sid = rec.get("student_id")
        status = rec.get("status")
        if not sid or status not in ("present", "absent", "late"):
            continue
        existing = (await db.execute(select(Attendance).where(
            and_(Attendance.student_id == sid, Attendance.date == req.date)
        ))).scalar_one_or_none()
        if existing:
            existing.status = status
            existing.class_name = req.class_name
            existing.marked_by = user["id"]
            existing.marked_at = datetime.now(timezone.utc)
        else:
            db.add(Attendance(student_id=sid, class_name=req.class_name, date=req.date,
                              status=status, marked_by=user["id"],
                              marked_at=datetime.now(timezone.utc)))
        count += 1
    await db.commit()
    return {"ok": True, "count": count}


# ---------- Fees ----------
@api_router.get("/fees")
async def list_fees(student_id: Optional[str] = None, user: dict = Depends(get_current_user),
                    db: AsyncSession = Depends(get_db)):
    q = select(Fee)
    if student_id:
        q = q.where(Fee.student_id == student_id)
    if user["role"] == "student":
        s = (await db.execute(select(Student).where(Student.user_id == user["id"]))).scalar_one_or_none()
        if s:
            q = q.where(Fee.student_id == s.id)
    if user["role"] == "parent":
        kid_ids = [r[0] for r in (await db.execute(select(Student.id).where(
            Student.parent_id == user["id"]))).all()]
        q = q.where(Fee.student_id.in_(kid_ids))
    rows = (await db.execute(q)).scalars().all()
    return [{"id": f.id, "student_id": f.student_id, "term": f.term, "amount": float(f.amount),
             "paid": float(f.paid), "due_date": f.due_date, "status": f.status} for f in rows]


@api_router.post("/fees/pay")
async def pay_fee(req: PaymentRequest, user: dict = Depends(get_current_user),
                  db: AsyncSession = Depends(get_db)):
    f = (await db.execute(select(Fee).where(Fee.id == req.fee_id))).scalar_one_or_none()
    if not f:
        raise HTTPException(404, "Fee not found")
    f.paid = (f.paid or 0) + req.amount
    f.status = "paid" if f.paid >= f.amount else "pending"
    p = Payment(fee_id=f.id, student_id=f.student_id, amount=req.amount, method=req.method,
                paid_at=datetime.now(timezone.utc))
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return {"ok": True, "payment_id": p.id, "new_status": f.status}


@api_router.get("/payments")
async def list_payments(student_id: Optional[str] = None, user: dict = Depends(get_current_user),
                        db: AsyncSession = Depends(get_db)):
    q = select(Payment).order_by(Payment.paid_at.desc())
    if student_id:
        q = q.where(Payment.student_id == student_id)
    if user["role"] == "student":
        s = (await db.execute(select(Student).where(Student.user_id == user["id"]))).scalar_one_or_none()
        if s:
            q = q.where(Payment.student_id == s.id)
    rows = (await db.execute(q)).scalars().all()
    return [{"id": p.id, "fee_id": p.fee_id, "student_id": p.student_id,
             "amount": float(p.amount), "method": p.method, "paid_at": p.paid_at} for p in rows]


# ---------- Timetable ----------
@api_router.get("/timetable")
async def get_timetable(class_name: Optional[str] = None, user: dict = Depends(get_current_user),
                        db: AsyncSession = Depends(get_db)):
    q = select(TimetableSlot)
    if user["role"] == "student":
        s = (await db.execute(select(Student).where(Student.user_id == user["id"]))).scalar_one_or_none()
        if s:
            q = q.where(TimetableSlot.class_name == s.class_name)
    elif class_name:
        q = q.where(TimetableSlot.class_name == class_name)
    rows = (await db.execute(q)).scalars().all()
    return [{"id": r.id, "class_name": r.class_name, "day": r.day, "period": r.period,
             "subject": r.subject, "teacher_name": r.teacher_name, "time": r.time} for r in rows]


# ---------- Exams & Results ----------
@api_router.get("/exams")
async def list_exams(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = select(Exam)
    if user["role"] == "student":
        s = (await db.execute(select(Student).where(Student.user_id == user["id"]))).scalar_one_or_none()
        if s:
            q = q.where(Exam.class_name == s.class_name)
    rows = (await db.execute(q)).scalars().all()
    return [{"id": e.id, "name": e.name, "class_name": e.class_name, "subject": e.subject,
             "date": e.date, "max_marks": e.max_marks} for e in rows]


@api_router.get("/results")
async def list_results(student_id: Optional[str] = None, user: dict = Depends(get_current_user),
                       db: AsyncSession = Depends(get_db)):
    q = select(Result)
    if student_id:
        q = q.where(Result.student_id == student_id)
    if user["role"] == "student":
        s = (await db.execute(select(Student).where(Student.user_id == user["id"]))).scalar_one_or_none()
        if s:
            q = q.where(Result.student_id == s.id)
    if user["role"] == "parent":
        kid_ids = [r[0] for r in (await db.execute(select(Student.id).where(
            Student.parent_id == user["id"]))).all()]
        q = q.where(Result.student_id.in_(kid_ids))
    rows = (await db.execute(q)).scalars().all()
    out = []
    for r in rows:
        e = (await db.execute(select(Exam).where(Exam.id == r.exam_id))).scalar_one_or_none()
        out.append({
            "id": r.id, "exam_id": r.exam_id, "student_id": r.student_id,
            "marks": float(r.marks), "grade": r.grade,
            "exam": {"id": e.id, "name": e.name, "subject": e.subject, "date": e.date,
                     "max_marks": e.max_marks, "class_name": e.class_name} if e else None,
        })
    return out


# ---------- Notifications ----------
@api_router.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = select(Notification).where(or_(
        Notification.audience == "all",
        Notification.audience == user["role"],
        Notification.audience == user["id"],
    )).order_by(Notification.created_at.desc())
    rows = (await db.execute(q)).scalars().all()
    return [{"id": n.id, "title": n.title, "message": n.message, "type": n.type,
             "audience": n.audience, "created_at": n.created_at,
             "is_read": user["id"] in (n.read_by or [])} for n in rows]


@api_router.post("/notifications")
async def create_notification(req: CreateNotificationRequest,
                              user: dict = Depends(require_role("admin")),
                              db: AsyncSession = Depends(get_db)):
    n = Notification(title=req.title, message=req.message, type=req.type,
                     audience=req.audience, created_at=datetime.now(timezone.utc), read_by=[])
    db.add(n)
    await db.commit()
    await db.refresh(n)
    return {"id": n.id, "title": n.title, "message": n.message, "type": n.type,
            "audience": n.audience, "created_at": n.created_at, "read_by": []}


@api_router.post("/notifications/{nid}/read")
async def mark_notif_read(nid: str, user: dict = Depends(get_current_user),
                          db: AsyncSession = Depends(get_db)):
    n = (await db.execute(select(Notification).where(Notification.id == nid))).scalar_one_or_none()
    if n and user["id"] not in (n.read_by or []):
        n.read_by = (n.read_by or []) + [user["id"]]
        await db.commit()
    return {"ok": True}


# ---------- Leaves ----------
@api_router.get("/leaves")
async def list_leaves(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = select(Leave).order_by(Leave.created_at.desc())
    if user["role"] != "admin":
        q = q.where(Leave.user_id == user["id"])
    rows = (await db.execute(q)).scalars().all()
    return [{"id": l.id, "user_id": l.user_id, "user_name": l.user_name, "role": l.role,
             "from_date": l.from_date, "to_date": l.to_date, "reason": l.reason,
             "status": l.status, "created_at": l.created_at} for l in rows]


@api_router.post("/leaves")
async def apply_leave(req: ApplyLeaveRequest, user: dict = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    l = Leave(user_id=user["id"], user_name=user["name"], role=user["role"],
              from_date=req.from_date, to_date=req.to_date, reason=req.reason,
              status="pending", created_at=datetime.now(timezone.utc))
    db.add(l)
    await db.commit()
    await db.refresh(l)
    return {"id": l.id, "status": l.status, "from_date": l.from_date,
            "to_date": l.to_date, "reason": l.reason}


@api_router.post("/leaves/{lid}/approve")
async def approve_leave(lid: str, user: dict = Depends(require_role("admin")),
                        db: AsyncSession = Depends(get_db)):
    l = (await db.execute(select(Leave).where(Leave.id == lid))).scalar_one_or_none()
    if l:
        l.status = "approved"
        await db.commit()
    return {"ok": True}


@api_router.post("/leaves/{lid}/reject")
async def reject_leave(lid: str, user: dict = Depends(require_role("admin")),
                       db: AsyncSession = Depends(get_db)):
    l = (await db.execute(select(Leave).where(Leave.id == lid))).scalar_one_or_none()
    if l:
        l.status = "rejected"
        await db.commit()
    return {"ok": True}


@api_router.get("/")
async def root():
    return {"message": "Scholara — School Management System API", "version": "2.0.0 (Supabase)"}


# ---------- Seed ----------
async def seed_data():
    async with AsyncSessionLocal() as db:
        count = (await db.execute(select(func.count()).select_from(User))).scalar_one()
        if count > 0:
            logger.info("Database already seeded (%s users)", count)
            return
        logger.info("Seeding Supabase database...")
        now = datetime.now(timezone.utc)

        admin = User(name="Admin User", email="admin@school.com", password=hash_password("admin123"),
                     role="admin", phone="+1234567890", created_at=now)
        t1 = User(name="Sarah Johnson", email="teacher@school.com", password=hash_password("teacher123"),
                  role="teacher", phone="+1234567891", created_at=now)
        t2 = User(name="Michael Chen", email="michael@school.com", password=hash_password("teacher123"),
                  role="teacher", phone="+1234567892", created_at=now)
        s1 = User(name="Emma Wilson", email="student@school.com", password=hash_password("student123"),
                  role="student", phone="+1234567893", created_at=now)
        s2 = User(name="Liam Garcia", email="liam@school.com", password=hash_password("student123"),
                  role="student", phone="+1234567894", created_at=now)
        par = User(name="Robert Wilson", email="parent@school.com", password=hash_password("parent123"),
                   role="parent", phone="+1234567895", created_at=now)
        db.add_all([admin, t1, t2, s1, s2, par])
        await db.flush()

        db.add_all([
            SchoolClass(name="10-A", grade="10", section="A", teacher_id=t1.id),
            SchoolClass(name="10-B", grade="10", section="B", teacher_id=t2.id),
            SchoolClass(name="9-A", grade="9", section="A", teacher_id=t1.id),
        ])

        db.add_all([
            Teacher(user_id=t1.id, name="Sarah Johnson", email="teacher@school.com",
                    subject="Mathematics", classes=["10-A", "9-A"]),
            Teacher(user_id=t2.id, name="Michael Chen", email="michael@school.com",
                    subject="Science", classes=["10-B"]),
        ])

        students = []
        s1_st = Student(user_id=s1.id, name="Emma Wilson", email="student@school.com",
                        roll_no="10A01", class_name="10-A", section="A", parent_id=par.id, phone="+1234567893")
        s2_st = Student(user_id=s2.id, name="Liam Garcia", email="liam@school.com",
                        roll_no="10A02", class_name="10-A", section="A", phone="+1234567894")
        students.extend([s1_st, s2_st])
        extras = [("Olivia Brown", "10A03"), ("Noah Davis", "10A04"), ("Ava Martinez", "10A05"),
                  ("Ethan Lopez", "10A06"), ("Sophia Lee", "10A07"), ("Mason Taylor", "10A08"),
                  ("Isabella Clark", "10A09"), ("James Walker", "10A10")]
        extra_students = []
        for (name, roll) in extras:
            extra_users = User(name=name, email=f"{name.split()[0].lower()}@school.com",
                               password=hash_password("student123"), role="student", created_at=now)
            db.add(extra_users)
            await db.flush()
            st = Student(user_id=extra_users.id, name=name,
                         email=extra_users.email, roll_no=roll, class_name="10-A", section="A")
            extra_students.append(st)
        db.add_all(students + extra_students)
        await db.flush()
        all_students = students + extra_students

        fees = []
        for s in all_students:
            fees.append(Fee(student_id=s.id, term="Term 1 2026", amount=1500.0,
                            paid=1500.0 if s.roll_no == "10A02" else 0.0,
                            due_date="2026-03-15",
                            status="paid" if s.roll_no == "10A02" else "pending"))
            fees.append(Fee(student_id=s.id, term="Term 2 2026", amount=1500.0,
                            paid=0.0, due_date="2026-06-15", status="pending"))
        db.add_all(fees)

        days = ["Mon", "Tue", "Wed", "Thu", "Fri"]
        subjects = [("Mathematics", "Sarah Johnson"), ("Science", "Michael Chen"),
                    ("English", "Alex Kim"), ("History", "Diana Ross"),
                    ("Physical Ed", "Coach Brian"), ("Arts", "Luna Park")]
        times = ["08:00-09:00", "09:00-10:00", "10:15-11:15", "11:15-12:15", "13:00-14:00", "14:00-15:00"]
        for d in days:
            for period, (subj, teach) in enumerate(subjects, 1):
                db.add(TimetableSlot(class_name="10-A", day=d, period=period,
                                     subject=subj, teacher_name=teach, time=times[period - 1]))

        e1 = Exam(name="Mid-Term", class_name="10-A", subject="Mathematics", date="2026-02-20", max_marks=100)
        e2 = Exam(name="Mid-Term", class_name="10-A", subject="Science", date="2026-02-22", max_marks=100)
        db.add_all([e1, e2])
        await db.flush()

        def g(m):
            return "A+" if m >= 90 else ("A" if m >= 80 else ("B" if m >= 70 else ("C" if m >= 60 else "D")))

        db.add_all([
            Result(exam_id=e1.id, student_id=s1_st.id, marks=87, grade=g(87)),
            Result(exam_id=e2.id, student_id=s1_st.id, marks=92, grade=g(92)),
            Result(exam_id=e1.id, student_id=s2_st.id, marks=78, grade=g(78)),
        ])

        today_dt = datetime.now(timezone.utc).date()
        for i in range(14):
            d = today_dt - timedelta(days=i)
            if d.weekday() >= 5:
                continue
            for s in all_students:
                r = random.random()
                status = "present" if r < 0.85 else ("late" if r < 0.9 else "absent")
                db.add(Attendance(student_id=s.id, class_name=s.class_name,
                                  date=d.strftime("%Y-%m-%d"), status=status,
                                  marked_by=t1.id, marked_at=now))

        db.add_all([
            Notification(title="Welcome to School!",
                         message="Welcome to the new academic year 2026!",
                         type="announcement", audience="all", created_at=now, read_by=[]),
            Notification(title="Fee Reminder",
                         message="Term 2 fees are due by June 15.",
                         type="fee", audience="parent", created_at=now, read_by=[]),
            Notification(title="Parent-Teacher Meeting",
                         message="PTM scheduled for Saturday 10 AM.",
                         type="announcement", audience="all", created_at=now, read_by=[]),
            Notification(title="Sports Day",
                         message="Annual sports day on March 5.",
                         type="general", audience="student", created_at=now, read_by=[]),
        ])

        await db.commit()
        logger.info("Seed complete.")


app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def on_startup():
    try:
        await seed_data()
    except Exception as e:
        logger.exception("Seed failed: %s", e)


@app.on_event("shutdown")
async def on_shutdown():
    await engine.dispose()
