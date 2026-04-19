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
    TimetableSlot, Exam, Result, Notification, Leave, Material, Institution,
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
    email: str  # email OR roll_no
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
    type: Literal["announcement", "fee", "attendance", "general", "circular", "result", "meeting"] = "announcement"
    audience: str = "all"
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    meeting_url: Optional[str] = None


class CreateMaterialRequest(BaseModel):
    title: str
    description: Optional[str] = None
    subject: Optional[str] = None
    class_name: Optional[str] = None
    file_url: str
    file_name: Optional[str] = None
    file_type: Optional[str] = None  # pdf / image / video / link


class CreateResultsRequest(BaseModel):
    exam_id: str
    records: List[dict]  # [{student_id, marks}]


async def _notify(db: AsyncSession, title: str, message: str, audience: str,
                  ntype: str = "general", attachment_url: Optional[str] = None,
                  attachment_name: Optional[str] = None, meeting_url: Optional[str] = None):
    n = Notification(
        title=title, message=message, type=ntype, audience=audience,
        attachment_url=attachment_url, attachment_name=attachment_name,
        meeting_url=meeting_url,
        created_at=datetime.now(timezone.utc), read_by=[],
    )
    db.add(n)


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
    identifier = req.email.strip()
    u = None
    # allow login with either email or roll_no
    if "@" in identifier:
        res = await db.execute(select(User).where(User.email == identifier.lower()))
        u = res.scalar_one_or_none()
    else:
        # lookup by roll_no via student
        s = (await db.execute(select(Student).where(Student.roll_no == identifier))).scalar_one_or_none()
        if s:
            u = (await db.execute(select(User).where(User.id == s.user_id))).scalar_one_or_none()
    if not u or not verify_password(req.password, u.password):
        raise HTTPException(401, "Invalid credentials")
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
async def create_student(req: CreateStudentRequest, user: dict = Depends(require_role("admin", "teacher")),
                         db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(select(User).where(User.email == req.email.lower()))).scalar_one_or_none()
    if existing:
        raise HTTPException(400, "Email already registered")
    existing_roll = (await db.execute(select(Student).where(Student.roll_no == req.roll_no))).scalar_one_or_none()
    if existing_roll:
        raise HTTPException(400, "Roll number already exists")
    u = User(name=req.name, email=req.email.lower(), password=hash_password(req.password),
             role="student", avatar=req.avatar, phone=req.phone)
    db.add(u)
    await db.flush()
    s = Student(user_id=u.id, name=req.name, email=req.email.lower(), roll_no=req.roll_no,
                class_name=req.class_name, section=req.section, avatar=req.avatar, phone=req.phone)
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return {"id": s.id, "user_id": u.id, "roll_no": s.roll_no}


class UpdateStudentRequest(BaseModel):
    name: Optional[str] = None
    roll_no: Optional[str] = None
    class_name: Optional[str] = None
    section: Optional[str] = None
    phone: Optional[str] = None
    avatar: Optional[str] = None
    password: Optional[str] = None  # reset password


@api_router.put("/students/{student_id}")
async def update_student(student_id: str, req: UpdateStudentRequest,
                         user: dict = Depends(require_role("admin", "teacher")),
                         db: AsyncSession = Depends(get_db)):
    s = (await db.execute(select(Student).where(Student.id == student_id))).scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Student not found")
    if req.roll_no and req.roll_no != s.roll_no:
        existing = (await db.execute(select(Student).where(
            and_(Student.roll_no == req.roll_no, Student.id != student_id)
        ))).scalar_one_or_none()
        if existing:
            raise HTTPException(400, "Roll number already in use")
        s.roll_no = req.roll_no
    if req.name:
        s.name = req.name
        # sync user name
        u = (await db.execute(select(User).where(User.id == s.user_id))).scalar_one_or_none()
        if u:
            u.name = req.name
    if req.class_name: s.class_name = req.class_name
    if req.section: s.section = req.section
    if req.phone is not None: s.phone = req.phone
    if req.avatar is not None: s.avatar = req.avatar
    if req.password:
        u = (await db.execute(select(User).where(User.id == s.user_id))).scalar_one_or_none()
        if u:
            u.password = hash_password(req.password)
    await db.commit()
    await db.refresh(s)
    return student_to_dict(s)


@api_router.delete("/students/{student_id}")
async def delete_student(student_id: str, user: dict = Depends(require_role("admin", "teacher")),
                         db: AsyncSession = Depends(get_db)):
    s = (await db.execute(select(Student).where(Student.id == student_id))).scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Student not found")
    u = (await db.execute(select(User).where(User.id == s.user_id))).scalar_one_or_none()
    await db.delete(s)
    if u:
        await db.delete(u)
    await db.commit()
    return {"ok": True}


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
    absent_ids: List[str] = []
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
        if status == "absent":
            absent_ids.append(sid)
        count += 1
    # Notify parents of absent students
    for sid in absent_ids:
        s = (await db.execute(select(Student).where(Student.id == sid))).scalar_one_or_none()
        if not s:
            continue
        if s.parent_id:
            await _notify(db,
                          title=f"Absence: {s.name}",
                          message=f"Your child {s.name} (Roll {s.roll_no}, {s.class_name}) was marked absent on {req.date}.",
                          audience=s.parent_id, ntype="attendance")
        # Also notify student
        await _notify(db,
                      title="You were marked absent",
                      message=f"You were marked absent on {req.date} for {req.class_name}.",
                      audience=s.user_id, ntype="attendance")
    await db.commit()
    return {"ok": True, "count": count, "absent_count": len(absent_ids)}


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
             "attachment_url": n.attachment_url, "attachment_name": n.attachment_name,
             "meeting_url": n.meeting_url,
             "is_read": user["id"] in (n.read_by or [])} for n in rows]


@api_router.post("/notifications")
async def create_notification(req: CreateNotificationRequest,
                              user: dict = Depends(require_role("admin", "teacher")),
                              db: AsyncSession = Depends(get_db)):
    n = Notification(title=req.title, message=req.message, type=req.type,
                     audience=req.audience, attachment_url=req.attachment_url,
                     attachment_name=req.attachment_name, meeting_url=req.meeting_url,
                     created_at=datetime.now(timezone.utc), read_by=[])
    db.add(n)
    await db.commit()
    await db.refresh(n)
    return {"id": n.id, "title": n.title, "message": n.message, "type": n.type,
            "audience": n.audience, "attachment_url": n.attachment_url,
            "attachment_name": n.attachment_name, "meeting_url": n.meeting_url,
            "created_at": n.created_at, "read_by": []}


@api_router.post("/notifications/{nid}/read")
async def mark_notif_read(nid: str, user: dict = Depends(get_current_user),
                          db: AsyncSession = Depends(get_db)):
    n = (await db.execute(select(Notification).where(Notification.id == nid))).scalar_one_or_none()
    if n and user["id"] not in (n.read_by or []):
        n.read_by = (n.read_by or []) + [user["id"]]
        await db.commit()
    return {"ok": True}


@api_router.get("/notifications/unread-count")
async def unread_count(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = select(Notification).where(or_(
        Notification.audience == "all",
        Notification.audience == user["role"],
        Notification.audience == user["id"],
    ))
    rows = (await db.execute(q)).scalars().all()
    n = sum(1 for r in rows if user["id"] not in (r.read_by or []))
    return {"count": n}


# ---------- Materials ----------
@api_router.get("/materials")
async def list_materials(class_name: Optional[str] = None,
                         user: dict = Depends(get_current_user),
                         db: AsyncSession = Depends(get_db)):
    q = select(Material).order_by(Material.created_at.desc())
    if user["role"] == "student":
        s = (await db.execute(select(Student).where(Student.user_id == user["id"]))).scalar_one_or_none()
        if s:
            q = q.where(or_(Material.class_name == s.class_name, Material.class_name.is_(None)))
    elif user["role"] == "parent":
        kids = (await db.execute(select(Student).where(Student.parent_id == user["id"]))).scalars().all()
        class_names = list({k.class_name for k in kids})
        if class_names:
            q = q.where(or_(Material.class_name.in_(class_names), Material.class_name.is_(None)))
    elif class_name:
        q = q.where(Material.class_name == class_name)
    rows = (await db.execute(q)).scalars().all()
    return [{"id": m.id, "title": m.title, "description": m.description,
             "subject": m.subject, "class_name": m.class_name, "file_url": m.file_url,
             "file_name": m.file_name, "file_type": m.file_type,
             "uploaded_by": m.uploaded_by, "uploaded_by_name": m.uploaded_by_name,
             "created_at": m.created_at} for m in rows]


@api_router.post("/materials")
async def create_material(req: CreateMaterialRequest,
                          user: dict = Depends(require_role("admin", "teacher")),
                          db: AsyncSession = Depends(get_db)):
    m = Material(title=req.title, description=req.description, subject=req.subject,
                 class_name=req.class_name, file_url=req.file_url, file_name=req.file_name,
                 file_type=req.file_type, uploaded_by=user["id"], uploaded_by_name=user["name"],
                 created_at=datetime.now(timezone.utc))
    db.add(m)
    # auto-notify students of that class (or 'student' role if no class)
    audience = "student"
    if req.class_name:
        # notify by class_name; will filter via audience=class-specific: fallback to 'student'
        pass
    await _notify(db,
                  title=f"New Study Material: {req.title}",
                  message=f"{user['name']} uploaded {req.file_name or req.title}" + (f" for {req.class_name}" if req.class_name else ""),
                  audience=audience, ntype="circular",
                  attachment_url=req.file_url, attachment_name=req.file_name)
    await db.commit()
    await db.refresh(m)
    return {"id": m.id, "title": m.title, "file_url": m.file_url}


@api_router.delete("/materials/{mid}")
async def delete_material(mid: str, user: dict = Depends(require_role("admin", "teacher")),
                          db: AsyncSession = Depends(get_db)):
    m = (await db.execute(select(Material).where(Material.id == mid))).scalar_one_or_none()
    if not m:
        raise HTTPException(404, "Not found")
    await db.delete(m)
    await db.commit()
    return {"ok": True}


# ---------- Results publish ----------
@api_router.post("/results/publish")
async def publish_results(req: CreateResultsRequest,
                          user: dict = Depends(require_role("admin", "teacher")),
                          db: AsyncSession = Depends(get_db)):
    exam = (await db.execute(select(Exam).where(Exam.id == req.exam_id))).scalar_one_or_none()
    if not exam:
        raise HTTPException(404, "Exam not found")

    def grade_of(m, maxm):
        p = (m / maxm * 100) if maxm else 0
        if p >= 90: return "A+"
        if p >= 80: return "A"
        if p >= 70: return "B"
        if p >= 60: return "C"
        if p >= 50: return "D"
        return "F"

    created = 0
    for rec in req.records:
        sid = rec.get("student_id")
        marks = float(rec.get("marks", 0))
        if not sid:
            continue
        existing = (await db.execute(select(Result).where(
            and_(Result.exam_id == exam.id, Result.student_id == sid)
        ))).scalar_one_or_none()
        g = grade_of(marks, exam.max_marks)
        if existing:
            existing.marks = marks
            existing.grade = g
        else:
            db.add(Result(exam_id=exam.id, student_id=sid, marks=marks, grade=g))
            created += 1
        s = (await db.execute(select(Student).where(Student.id == sid))).scalar_one_or_none()
        if s:
            msg = f"Your {exam.name} result for {exam.subject} is out. Marks: {marks}/{exam.max_marks} ({g})."
            await _notify(db, title=f"Result: {exam.name} - {exam.subject}",
                          message=msg, audience=s.user_id, ntype="result")
            if s.parent_id:
                await _notify(db, title=f"{s.name}'s Result Published",
                              message=f"{s.name}: {msg}", audience=s.parent_id, ntype="result")
    await db.commit()
    return {"ok": True, "published": len(req.records), "created": created}


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


# ---------- Institutions (super-admin) ----------
class InstitutionRequest(BaseModel):
    name: str
    type: Literal["school", "college", "coaching"] = "school"
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    logo: Optional[str] = None
    plan: Optional[str] = "free"
    active: Optional[bool] = True


def inst_to_dict(i: Institution) -> dict:
    return {"id": i.id, "name": i.name, "type": i.type,
            "city": i.city, "state": i.state, "country": i.country, "address": i.address,
            "phone": i.phone, "email": i.email, "logo": i.logo,
            "plan": i.plan, "active": i.active, "created_at": i.created_at}


@api_router.get("/institutions")
async def list_institutions(user: dict = Depends(require_role("admin", "superadmin")),
                            db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Institution).order_by(Institution.created_at.desc()))).scalars().all()
    return [inst_to_dict(i) for i in rows]


@api_router.post("/institutions")
async def create_institution(req: InstitutionRequest,
                             user: dict = Depends(require_role("admin", "superadmin")),
                             db: AsyncSession = Depends(get_db)):
    i = Institution(**req.model_dump(), created_at=datetime.now(timezone.utc))
    db.add(i)
    await db.commit()
    await db.refresh(i)
    return inst_to_dict(i)


@api_router.put("/institutions/{iid}")
async def update_institution(iid: str, req: InstitutionRequest,
                             user: dict = Depends(require_role("admin", "superadmin")),
                             db: AsyncSession = Depends(get_db)):
    i = (await db.execute(select(Institution).where(Institution.id == iid))).scalar_one_or_none()
    if not i:
        raise HTTPException(404, "Not found")
    for k, v in req.model_dump().items():
        setattr(i, k, v)
    await db.commit()
    await db.refresh(i)
    return inst_to_dict(i)


@api_router.delete("/institutions/{iid}")
async def delete_institution(iid: str, user: dict = Depends(require_role("admin", "superadmin")),
                             db: AsyncSession = Depends(get_db)):
    i = (await db.execute(select(Institution).where(Institution.id == iid))).scalar_one_or_none()
    if not i:
        raise HTTPException(404, "Not found")
    await db.delete(i)
    await db.commit()
    return {"ok": True}


# ---------- Bulk CSV Import ----------
class CSVImportRequest(BaseModel):
    csv: str  # first line headers: name,email,roll_no,class_name,section,phone,password (password optional)


@api_router.post("/students/import")
async def import_students_csv(req: CSVImportRequest,
                              user: dict = Depends(require_role("admin", "teacher")),
                              db: AsyncSession = Depends(get_db)):
    import csv
    from io import StringIO
    reader = csv.DictReader(StringIO(req.csv.strip()))
    created = 0
    skipped = 0
    errors: List[str] = []
    for idx, row in enumerate(reader, start=2):
        name = (row.get("name") or "").strip()
        email = (row.get("email") or "").strip().lower()
        roll_no = (row.get("roll_no") or "").strip()
        class_name = (row.get("class_name") or "").strip()
        section = (row.get("section") or "A").strip()
        phone = (row.get("phone") or "").strip() or None
        password = (row.get("password") or "student123").strip()
        if not name or not email or not roll_no or not class_name:
            errors.append(f"Row {idx}: missing required fields")
            skipped += 1
            continue
        existing_user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        existing_roll = (await db.execute(select(Student).where(Student.roll_no == roll_no))).scalar_one_or_none()
        if existing_user or existing_roll:
            errors.append(f"Row {idx} ({email}/{roll_no}): already exists")
            skipped += 1
            continue
        u = User(name=name, email=email, password=hash_password(password),
                 role="student", phone=phone, created_at=datetime.now(timezone.utc))
        db.add(u)
        await db.flush()
        db.add(Student(user_id=u.id, name=name, email=email, roll_no=roll_no,
                       class_name=class_name, section=section, phone=phone))
        created += 1
    await db.commit()
    return {"ok": True, "created": created, "skipped": skipped, "errors": errors}


# ---------- Attendance Analytics ----------
@api_router.get("/attendance/analytics")
async def attendance_analytics(user: dict = Depends(require_role("admin", "teacher", "superadmin")),
                               db: AsyncSession = Depends(get_db)):
    today = datetime.now(timezone.utc).date()
    today_str = today.strftime("%Y-%m-%d")
    # Today
    total_today = (await db.execute(select(func.count()).select_from(Attendance).where(
        Attendance.date == today_str))).scalar_one()
    present_today = (await db.execute(select(func.count()).select_from(Attendance).where(
        and_(Attendance.date == today_str, Attendance.status == "present")))).scalar_one()
    absent_today = (await db.execute(select(func.count()).select_from(Attendance).where(
        and_(Attendance.date == today_str, Attendance.status == "absent")))).scalar_one()
    late_today = (await db.execute(select(func.count()).select_from(Attendance).where(
        and_(Attendance.date == today_str, Attendance.status == "late")))).scalar_one()

    # Last 7 days trend
    week = []
    for i in range(6, -1, -1):
        d = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        total = (await db.execute(select(func.count()).select_from(Attendance).where(
            Attendance.date == d))).scalar_one()
        present = (await db.execute(select(func.count()).select_from(Attendance).where(
            and_(Attendance.date == d, Attendance.status == "present")))).scalar_one()
        week.append({"date": d, "total": total, "present": present,
                     "pct": round((present / total * 100) if total else 0, 1)})

    # Monthly
    month_start = today.replace(day=1).strftime("%Y-%m-%d")
    total_month = (await db.execute(select(func.count()).select_from(Attendance).where(
        Attendance.date >= month_start))).scalar_one()
    present_month = (await db.execute(select(func.count()).select_from(Attendance).where(
        and_(Attendance.date >= month_start, Attendance.status == "present")))).scalar_one()

    # Yearly
    year_start = today.replace(month=1, day=1).strftime("%Y-%m-%d")
    total_year = (await db.execute(select(func.count()).select_from(Attendance).where(
        Attendance.date >= year_start))).scalar_one()
    present_year = (await db.execute(select(func.count()).select_from(Attendance).where(
        and_(Attendance.date >= year_start, Attendance.status == "present")))).scalar_one()

    # Cumulative (all-time)
    total_all = (await db.execute(select(func.count()).select_from(Attendance))).scalar_one()
    present_all = (await db.execute(select(func.count()).select_from(Attendance).where(
        Attendance.status == "present"))).scalar_one()

    # Class-wise today
    class_rows = (await db.execute(
        select(Attendance.class_name,
               func.count().label("total"),
               func.sum(func.cast(Attendance.status == "present", sa_int())).label("present"))
        .where(Attendance.date == today_str)
        .group_by(Attendance.class_name)
    )).all()
    # Fallback for sum syntax: simpler approach
    class_wise = []
    names = set(r[0] for r in (await db.execute(select(Attendance.class_name).where(
        Attendance.date == today_str).distinct())).all())
    for cn in names:
        t = (await db.execute(select(func.count()).select_from(Attendance).where(
            and_(Attendance.class_name == cn, Attendance.date == today_str)))).scalar_one()
        p = (await db.execute(select(func.count()).select_from(Attendance).where(
            and_(Attendance.class_name == cn, Attendance.date == today_str,
                 Attendance.status == "present")))).scalar_one()
        class_wise.append({"class_name": cn, "present": p, "total": t,
                           "pct": round((p / t * 100) if t else 0, 1)})

    return {
        "today": {"total": total_today, "present": present_today,
                  "absent": absent_today, "late": late_today,
                  "pct": round((present_today / total_today * 100) if total_today else 0, 1)},
        "week_trend": week,
        "month": {"total": total_month, "present": present_month,
                  "pct": round((present_month / total_month * 100) if total_month else 0, 1)},
        "year": {"total": total_year, "present": present_year,
                 "pct": round((present_year / total_year * 100) if total_year else 0, 1)},
        "all_time": {"total": total_all, "present": present_all,
                     "pct": round((present_all / total_all * 100) if total_all else 0, 1)},
        "class_wise_today": sorted(class_wise, key=lambda x: -x["pct"]),
    }


def sa_int():
    from sqlalchemy import Integer
    return Integer


# ---------- Seed ----------
async def seed_data():
    async with AsyncSessionLocal() as db:
        # idempotent super-admin + institutions
        existing_super = (await db.execute(select(User).where(User.email == "superadmin@school.com"))).scalar_one_or_none()
        inst_count = (await db.execute(select(func.count()).select_from(Institution))).scalar_one()
        if not existing_super:
            now = datetime.now(timezone.utc)
            db.add(User(name="Super Admin", email="superadmin@school.com",
                        password=hash_password("super123"), role="superadmin",
                        phone="+1000000000", created_at=now))
            await db.commit()
            logger.info("Seeded super-admin")
        if inst_count == 0:
            now = datetime.now(timezone.utc)
            db.add_all([
                Institution(name="Scholara High School", type="school",
                            city="San Francisco", state="CA", country="USA",
                            address="1 Market St", phone="+14155551234",
                            email="info@scholarahs.edu", plan="pro", active=True,
                            created_at=now),
                Institution(name="Scholara College of Engineering", type="college",
                            city="Bangalore", state="KA", country="India",
                            address="MG Road", phone="+918012341234",
                            email="info@scholaraeng.ac.in", plan="enterprise", active=True,
                            created_at=now),
                Institution(name="Bright Future Coaching", type="coaching",
                            city="Mumbai", state="MH", country="India",
                            phone="+912299999999", plan="free", active=True,
                            created_at=now),
            ])
            await db.commit()
            logger.info("Seeded 3 institutions")

        count = (await db.execute(select(func.count()).select_from(User))).scalar_one()
        if count > 2:  # super-admin + institutions only
            logger.info("Main data already seeded (%s users)", count)
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
