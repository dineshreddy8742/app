from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, date, timedelta
import bcrypt
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Auth
JWT_SECRET = os.environ.get('JWT_SECRET', 'school-mgmt-secret-key-change-in-prod')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRE_DAYS = 30

security = HTTPBearer()

app = FastAPI(title="School Management System API")
api_router = APIRouter(prefix="/api")


# ---------- Helpers ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_role(*roles: str):
    async def _dep(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return _dep


# ---------- Models ----------
Role = Literal["admin", "teacher", "student", "parent"]


class UserPublic(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: Role
    avatar: Optional[str] = None
    phone: Optional[str] = None
    created_at: datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    token: str
    user: UserPublic


class StudentProfile(BaseModel):
    id: str
    user_id: str
    name: str
    email: EmailStr
    roll_no: str
    class_name: str
    section: str
    parent_id: Optional[str] = None
    avatar: Optional[str] = None
    phone: Optional[str] = None


class TeacherProfile(BaseModel):
    id: str
    user_id: str
    name: str
    email: EmailStr
    subject: str
    classes: List[str] = []
    avatar: Optional[str] = None


class ClassModel(BaseModel):
    id: str
    name: str  # e.g., "10-A"
    grade: str
    section: str
    teacher_id: Optional[str] = None


class AttendanceRecord(BaseModel):
    id: str
    student_id: str
    class_name: str
    date: str  # YYYY-MM-DD
    status: Literal["present", "absent", "late"]
    marked_by: str
    marked_at: datetime


class MarkAttendanceRequest(BaseModel):
    class_name: str
    date: str
    records: List[dict]  # [{student_id, status}]


class FeeRecord(BaseModel):
    id: str
    student_id: str
    term: str
    amount: float
    paid: float = 0
    due_date: str
    status: Literal["paid", "pending", "overdue"]


class PaymentRequest(BaseModel):
    fee_id: str
    amount: float
    method: str = "online"


class TimetableSlot(BaseModel):
    id: str
    class_name: str
    day: str  # Mon-Fri
    period: int
    subject: str
    teacher_name: str
    time: str  # e.g., "09:00-10:00"


class ExamModel(BaseModel):
    id: str
    name: str
    class_name: str
    subject: str
    date: str
    max_marks: int


class ResultModel(BaseModel):
    id: str
    exam_id: str
    student_id: str
    marks: float
    grade: str


class NotificationModel(BaseModel):
    id: str
    title: str
    message: str
    type: Literal["announcement", "fee", "attendance", "general"]
    audience: str  # "all", role, or user id
    created_at: datetime
    read_by: List[str] = []


class CreateNotificationRequest(BaseModel):
    title: str
    message: str
    type: Literal["announcement", "fee", "attendance", "general"] = "announcement"
    audience: str = "all"


class LeaveRequest(BaseModel):
    id: str
    user_id: str
    user_name: str
    role: str
    from_date: str
    to_date: str
    reason: str
    status: Literal["pending", "approved", "rejected"]
    created_at: datetime


class ApplyLeaveRequest(BaseModel):
    from_date: str
    to_date: str
    reason: str


# ---------- Auth Routes ----------
@api_router.post("/auth/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    user = await db.users.find_one({"email": req.email.lower()})
    if not user or not verify_password(req.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"], user["role"])
    user_public = {k: v for k, v in user.items() if k not in ("_id", "password")}
    return {"token": token, "user": user_public}


@api_router.get("/auth/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return user


# ---------- Dashboard ----------
@api_router.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    role = user["role"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    if role == "admin":
        total_students = await db.students.count_documents({})
        total_teachers = await db.teachers.count_documents({})
        total_classes = await db.classes.count_documents({})
        total_fees = 0.0
        collected = 0.0
        async for f in db.fees.find({}, {"_id": 0, "amount": 1, "paid": 1}):
            total_fees += f.get("amount", 0)
            collected += f.get("paid", 0)
        present_today = await db.attendance.count_documents({"date": today, "status": "present"})
        total_today = await db.attendance.count_documents({"date": today})
        attendance_pct = round((present_today / total_today * 100) if total_today else 0, 1)
        return {
            "role": "admin",
            "metrics": {
                "total_students": total_students,
                "total_teachers": total_teachers,
                "total_classes": total_classes,
                "total_fees": total_fees,
                "collected_fees": collected,
                "pending_fees": total_fees - collected,
                "attendance_today_pct": attendance_pct,
            },
        }

    if role == "teacher":
        teacher = await db.teachers.find_one({"user_id": user["id"]}, {"_id": 0})
        classes = teacher.get("classes", []) if teacher else []
        day_name = datetime.now(timezone.utc).strftime("%a")
        today_classes = []
        async for slot in db.timetable.find({"class_name": {"$in": classes}, "day": day_name}, {"_id": 0}):
            today_classes.append(slot)
        today_classes.sort(key=lambda x: x.get("period", 0))
        return {
            "role": "teacher",
            "teacher": teacher,
            "today_classes": today_classes,
            "assigned_classes": classes,
        }

    if role == "student":
        student = await db.students.find_one({"user_id": user["id"]}, {"_id": 0})
        if not student:
            return {"role": "student", "student": None}
        # attendance %
        total = await db.attendance.count_documents({"student_id": student["id"]})
        present = await db.attendance.count_documents({"student_id": student["id"], "status": "present"})
        pct = round((present / total * 100) if total else 0, 1)
        # fees
        fees_total = 0.0
        fees_paid = 0.0
        async for f in db.fees.find({"student_id": student["id"]}, {"_id": 0}):
            fees_total += f.get("amount", 0)
            fees_paid += f.get("paid", 0)
        # today classes
        day_name = datetime.now(timezone.utc).strftime("%a")
        today_classes = []
        async for slot in db.timetable.find({"class_name": student["class_name"], "day": day_name}, {"_id": 0}):
            today_classes.append(slot)
        today_classes.sort(key=lambda x: x.get("period", 0))
        return {
            "role": "student",
            "student": student,
            "attendance_pct": pct,
            "fees_total": fees_total,
            "fees_paid": fees_paid,
            "fees_due": fees_total - fees_paid,
            "today_classes": today_classes,
        }

    if role == "parent":
        # find linked children
        children = []
        async for s in db.students.find({"parent_id": user["id"]}, {"_id": 0}):
            total = await db.attendance.count_documents({"student_id": s["id"]})
            present = await db.attendance.count_documents({"student_id": s["id"], "status": "present"})
            pct = round((present / total * 100) if total else 0, 1)
            fees_total = 0.0
            fees_paid = 0.0
            async for f in db.fees.find({"student_id": s["id"]}, {"_id": 0}):
                fees_total += f.get("amount", 0)
                fees_paid += f.get("paid", 0)
            children.append({
                **s,
                "attendance_pct": pct,
                "fees_due": fees_total - fees_paid,
            })
        return {"role": "parent", "children": children}

    return {"role": role}


# ---------- Students ----------
@api_router.get("/students")
async def list_students(class_name: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if class_name:
        q["class_name"] = class_name
    if user["role"] == "parent":
        q["parent_id"] = user["id"]
    items = []
    async for s in db.students.find(q, {"_id": 0}):
        items.append(s)
    return items


@api_router.get("/students/{student_id}")
async def get_student(student_id: str, user: dict = Depends(get_current_user)):
    s = await db.students.find_one({"id": student_id}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Student not found")
    return s


class CreateStudentRequest(BaseModel):
    name: str
    email: EmailStr
    password: str = "student123"
    roll_no: str
    class_name: str
    section: str
    phone: Optional[str] = None
    avatar: Optional[str] = None


@api_router.post("/students")
async def create_student(req: CreateStudentRequest, user: dict = Depends(require_role("admin"))):
    existing = await db.users.find_one({"email": req.email.lower()})
    if existing:
        raise HTTPException(400, "Email already registered")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "name": req.name,
        "email": req.email.lower(),
        "password": hash_password(req.password),
        "role": "student",
        "avatar": req.avatar,
        "phone": req.phone,
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(user_doc)
    student_id = str(uuid.uuid4())
    await db.students.insert_one({
        "id": student_id,
        "user_id": user_id,
        "name": req.name,
        "email": req.email.lower(),
        "roll_no": req.roll_no,
        "class_name": req.class_name,
        "section": req.section,
        "parent_id": None,
        "avatar": req.avatar,
        "phone": req.phone,
    })
    return {"id": student_id, "user_id": user_id}


# ---------- Teachers ----------
@api_router.get("/teachers")
async def list_teachers(user: dict = Depends(get_current_user)):
    items = []
    async for t in db.teachers.find({}, {"_id": 0}):
        items.append(t)
    return items


# ---------- Classes ----------
@api_router.get("/classes")
async def list_classes(user: dict = Depends(get_current_user)):
    items = []
    async for c in db.classes.find({}, {"_id": 0}):
        items.append(c)
    return items


# ---------- Attendance ----------
@api_router.get("/attendance")
async def get_attendance(
    class_name: Optional[str] = None,
    student_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    q = {}
    if class_name:
        q["class_name"] = class_name
    if student_id:
        q["student_id"] = student_id
    if user["role"] == "student":
        s = await db.students.find_one({"user_id": user["id"]}, {"_id": 0})
        if s:
            q["student_id"] = s["id"]
    if date_from or date_to:
        rng = {}
        if date_from:
            rng["$gte"] = date_from
        if date_to:
            rng["$lte"] = date_to
        q["date"] = rng
    items = []
    async for a in db.attendance.find(q, {"_id": 0}):
        items.append(a)
    return items


@api_router.post("/attendance/mark")
async def mark_attendance(req: MarkAttendanceRequest, user: dict = Depends(require_role("admin", "teacher"))):
    # remove existing for that date+class then insert new
    for rec in req.records:
        student_id = rec.get("student_id")
        status_val = rec.get("status")
        if not student_id or status_val not in ("present", "absent", "late"):
            continue
        existing = await db.attendance.find_one({"student_id": student_id, "date": req.date})
        doc = {
            "id": existing["id"] if existing else str(uuid.uuid4()),
            "student_id": student_id,
            "class_name": req.class_name,
            "date": req.date,
            "status": status_val,
            "marked_by": user["id"],
            "marked_at": datetime.now(timezone.utc),
        }
        await db.attendance.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)
    return {"ok": True, "count": len(req.records)}


# ---------- Fees ----------
@api_router.get("/fees")
async def list_fees(student_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if student_id:
        q["student_id"] = student_id
    if user["role"] == "student":
        s = await db.students.find_one({"user_id": user["id"]}, {"_id": 0})
        if s:
            q["student_id"] = s["id"]
    if user["role"] == "parent":
        children_ids = [c["id"] async for c in db.students.find({"parent_id": user["id"]}, {"_id": 0, "id": 1})]
        q["student_id"] = {"$in": children_ids}
    items = []
    async for f in db.fees.find(q, {"_id": 0}):
        items.append(f)
    return items


@api_router.post("/fees/pay")
async def pay_fee(req: PaymentRequest, user: dict = Depends(get_current_user)):
    fee = await db.fees.find_one({"id": req.fee_id}, {"_id": 0})
    if not fee:
        raise HTTPException(404, "Fee not found")
    new_paid = fee.get("paid", 0) + req.amount
    new_status = "paid" if new_paid >= fee["amount"] else "pending"
    await db.fees.update_one({"id": req.fee_id}, {"$set": {"paid": new_paid, "status": new_status}})
    payment_id = str(uuid.uuid4())
    await db.payments.insert_one({
        "id": payment_id,
        "fee_id": req.fee_id,
        "student_id": fee["student_id"],
        "amount": req.amount,
        "method": req.method,
        "paid_at": datetime.now(timezone.utc),
    })
    return {"ok": True, "payment_id": payment_id, "new_status": new_status}


@api_router.get("/payments")
async def list_payments(student_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if student_id:
        q["student_id"] = student_id
    if user["role"] == "student":
        s = await db.students.find_one({"user_id": user["id"]}, {"_id": 0})
        if s:
            q["student_id"] = s["id"]
    items = []
    async for p in db.payments.find(q, {"_id": 0}).sort("paid_at", -1):
        items.append(p)
    return items


# ---------- Timetable ----------
@api_router.get("/timetable")
async def get_timetable(class_name: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if user["role"] == "student":
        s = await db.students.find_one({"user_id": user["id"]}, {"_id": 0})
        if s:
            q["class_name"] = s["class_name"]
    elif class_name:
        q["class_name"] = class_name
    items = []
    async for t in db.timetable.find(q, {"_id": 0}):
        items.append(t)
    return items


# ---------- Exams & Results ----------
@api_router.get("/exams")
async def list_exams(user: dict = Depends(get_current_user)):
    q = {}
    if user["role"] == "student":
        s = await db.students.find_one({"user_id": user["id"]}, {"_id": 0})
        if s:
            q["class_name"] = s["class_name"]
    items = []
    async for e in db.exams.find(q, {"_id": 0}):
        items.append(e)
    return items


@api_router.get("/results")
async def list_results(student_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if student_id:
        q["student_id"] = student_id
    if user["role"] == "student":
        s = await db.students.find_one({"user_id": user["id"]}, {"_id": 0})
        if s:
            q["student_id"] = s["id"]
    if user["role"] == "parent":
        children_ids = [c["id"] async for c in db.students.find({"parent_id": user["id"]}, {"_id": 0, "id": 1})]
        q["student_id"] = {"$in": children_ids}
    items = []
    async for r in db.results.find(q, {"_id": 0}):
        exam = await db.exams.find_one({"id": r["exam_id"]}, {"_id": 0})
        r["exam"] = exam
        items.append(r)
    return items


# ---------- Notifications ----------
@api_router.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    q = {"$or": [{"audience": "all"}, {"audience": user["role"]}, {"audience": user["id"]}]}
    items = []
    async for n in db.notifications.find(q, {"_id": 0}).sort("created_at", -1):
        n["is_read"] = user["id"] in n.get("read_by", [])
        items.append(n)
    return items


@api_router.post("/notifications")
async def create_notification(req: CreateNotificationRequest, user: dict = Depends(require_role("admin"))):
    doc = {
        "id": str(uuid.uuid4()),
        "title": req.title,
        "message": req.message,
        "type": req.type,
        "audience": req.audience,
        "created_at": datetime.now(timezone.utc),
        "read_by": [],
    }
    await db.notifications.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.post("/notifications/{nid}/read")
async def mark_read(nid: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": nid}, {"$addToSet": {"read_by": user["id"]}})
    return {"ok": True}


# ---------- Leave ----------
@api_router.get("/leaves")
async def list_leaves(user: dict = Depends(get_current_user)):
    q = {}
    if user["role"] not in ("admin",):
        q["user_id"] = user["id"]
    items = []
    async for l in db.leaves.find(q, {"_id": 0}).sort("created_at", -1):
        items.append(l)
    return items


@api_router.post("/leaves")
async def apply_leave(req: ApplyLeaveRequest, user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["name"],
        "role": user["role"],
        "from_date": req.from_date,
        "to_date": req.to_date,
        "reason": req.reason,
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
    }
    await db.leaves.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.post("/leaves/{lid}/approve")
async def approve_leave(lid: str, user: dict = Depends(require_role("admin"))):
    await db.leaves.update_one({"id": lid}, {"$set": {"status": "approved"}})
    return {"ok": True}


@api_router.post("/leaves/{lid}/reject")
async def reject_leave(lid: str, user: dict = Depends(require_role("admin"))):
    await db.leaves.update_one({"id": lid}, {"$set": {"status": "rejected"}})
    return {"ok": True}


# ---------- Root ----------
@api_router.get("/")
async def root():
    return {"message": "School Management System API", "version": "1.0.0"}


# ---------- Seed ----------
async def seed_data():
    if await db.users.count_documents({}) > 0:
        logger.info("Database already seeded")
        return
    logger.info("Seeding database...")
    now = datetime.now(timezone.utc)

    # Users
    admin_id = str(uuid.uuid4())
    teacher_id = str(uuid.uuid4())
    student_id = str(uuid.uuid4())
    parent_id = str(uuid.uuid4())
    teacher2_id = str(uuid.uuid4())
    student2_id = str(uuid.uuid4())

    users = [
        {"id": admin_id, "name": "Admin User", "email": "admin@school.com",
         "password": hash_password("admin123"), "role": "admin",
         "avatar": None, "phone": "+1234567890", "created_at": now},
        {"id": teacher_id, "name": "Sarah Johnson", "email": "teacher@school.com",
         "password": hash_password("teacher123"), "role": "teacher",
         "avatar": None, "phone": "+1234567891", "created_at": now},
        {"id": teacher2_id, "name": "Michael Chen", "email": "michael@school.com",
         "password": hash_password("teacher123"), "role": "teacher",
         "avatar": None, "phone": "+1234567892", "created_at": now},
        {"id": student_id, "name": "Emma Wilson", "email": "student@school.com",
         "password": hash_password("student123"), "role": "student",
         "avatar": None, "phone": "+1234567893", "created_at": now},
        {"id": student2_id, "name": "Liam Garcia", "email": "liam@school.com",
         "password": hash_password("student123"), "role": "student",
         "avatar": None, "phone": "+1234567894", "created_at": now},
        {"id": parent_id, "name": "Robert Wilson", "email": "parent@school.com",
         "password": hash_password("parent123"), "role": "parent",
         "avatar": None, "phone": "+1234567895", "created_at": now},
    ]
    await db.users.insert_many(users)

    # Classes
    classes = [
        {"id": str(uuid.uuid4()), "name": "10-A", "grade": "10", "section": "A", "teacher_id": teacher_id},
        {"id": str(uuid.uuid4()), "name": "10-B", "grade": "10", "section": "B", "teacher_id": teacher2_id},
        {"id": str(uuid.uuid4()), "name": "9-A", "grade": "9", "section": "A", "teacher_id": teacher_id},
    ]
    await db.classes.insert_many(classes)

    # Teachers
    await db.teachers.insert_many([
        {"id": str(uuid.uuid4()), "user_id": teacher_id, "name": "Sarah Johnson",
         "email": "teacher@school.com", "subject": "Mathematics",
         "classes": ["10-A", "9-A"], "avatar": None},
        {"id": str(uuid.uuid4()), "user_id": teacher2_id, "name": "Michael Chen",
         "email": "michael@school.com", "subject": "Science",
         "classes": ["10-B"], "avatar": None},
    ])

    # Students
    student_doc_id = str(uuid.uuid4())
    student2_doc_id = str(uuid.uuid4())
    students = [
        {"id": student_doc_id, "user_id": student_id, "name": "Emma Wilson",
         "email": "student@school.com", "roll_no": "10A01", "class_name": "10-A",
         "section": "A", "parent_id": parent_id, "avatar": None, "phone": "+1234567893"},
        {"id": student2_doc_id, "user_id": student2_id, "name": "Liam Garcia",
         "email": "liam@school.com", "roll_no": "10A02", "class_name": "10-A",
         "section": "A", "parent_id": None, "avatar": None, "phone": "+1234567894"},
    ]
    # Add 8 more students in 10-A for realistic attendance list
    extra_names = [
        ("Olivia Brown", "10A03"), ("Noah Davis", "10A04"),
        ("Ava Martinez", "10A05"), ("Ethan Lopez", "10A06"),
        ("Sophia Lee", "10A07"), ("Mason Taylor", "10A08"),
        ("Isabella Clark", "10A09"), ("James Walker", "10A10"),
    ]
    for (name, roll) in extra_names:
        students.append({
            "id": str(uuid.uuid4()), "user_id": str(uuid.uuid4()), "name": name,
            "email": f"{name.split()[0].lower()}@school.com", "roll_no": roll,
            "class_name": "10-A", "section": "A", "parent_id": None,
            "avatar": None, "phone": None,
        })
    await db.students.insert_many(students)

    # Fees
    fees = []
    for s in students:
        fees.append({
            "id": str(uuid.uuid4()), "student_id": s["id"], "term": "Term 1 2026",
            "amount": 1500.0, "paid": 1500.0 if s["id"] == student2_doc_id else 0.0,
            "due_date": "2026-03-15",
            "status": "paid" if s["id"] == student2_doc_id else "pending",
        })
        fees.append({
            "id": str(uuid.uuid4()), "student_id": s["id"], "term": "Term 2 2026",
            "amount": 1500.0, "paid": 0.0, "due_date": "2026-06-15", "status": "pending",
        })
    await db.fees.insert_many(fees)

    # Timetable for 10-A
    days = ["Mon", "Tue", "Wed", "Thu", "Fri"]
    subjects = [
        ("Mathematics", "Sarah Johnson"), ("Science", "Michael Chen"),
        ("English", "Alex Kim"), ("History", "Diana Ross"),
        ("Physical Ed", "Coach Brian"), ("Arts", "Luna Park"),
    ]
    times = ["08:00-09:00", "09:00-10:00", "10:15-11:15", "11:15-12:15", "13:00-14:00", "14:00-15:00"]
    timetable = []
    for d in days:
        for period, (subject, teacher) in enumerate(subjects, 1):
            timetable.append({
                "id": str(uuid.uuid4()), "class_name": "10-A", "day": d,
                "period": period, "subject": subject, "teacher_name": teacher,
                "time": times[period - 1],
            })
    await db.timetable.insert_many(timetable)

    # Exams
    exam1_id = str(uuid.uuid4())
    exam2_id = str(uuid.uuid4())
    await db.exams.insert_many([
        {"id": exam1_id, "name": "Mid-Term", "class_name": "10-A",
         "subject": "Mathematics", "date": "2026-02-20", "max_marks": 100},
        {"id": exam2_id, "name": "Mid-Term", "class_name": "10-A",
         "subject": "Science", "date": "2026-02-22", "max_marks": 100},
    ])

    # Results for Emma
    def grade_of(m):
        if m >= 90: return "A+"
        if m >= 80: return "A"
        if m >= 70: return "B"
        if m >= 60: return "C"
        return "D"
    await db.results.insert_many([
        {"id": str(uuid.uuid4()), "exam_id": exam1_id, "student_id": student_doc_id,
         "marks": 87, "grade": grade_of(87)},
        {"id": str(uuid.uuid4()), "exam_id": exam2_id, "student_id": student_doc_id,
         "marks": 92, "grade": grade_of(92)},
        {"id": str(uuid.uuid4()), "exam_id": exam1_id, "student_id": student2_doc_id,
         "marks": 78, "grade": grade_of(78)},
    ])

    # Attendance for last 14 days for all 10-A students
    import random
    today_dt = datetime.now(timezone.utc).date()
    attendance_docs = []
    for i in range(14):
        d = (today_dt - timedelta(days=i)).strftime("%Y-%m-%d")
        day_of_week = (today_dt - timedelta(days=i)).weekday()
        if day_of_week >= 5:
            continue  # skip weekends
        for s in students:
            # 85% present, 10% absent, 5% late
            r = random.random()
            status_val = "present" if r < 0.85 else ("late" if r < 0.9 else "absent")
            attendance_docs.append({
                "id": str(uuid.uuid4()),
                "student_id": s["id"],
                "class_name": s["class_name"],
                "date": d,
                "status": status_val,
                "marked_by": teacher_id,
                "marked_at": now,
            })
    if attendance_docs:
        await db.attendance.insert_many(attendance_docs)

    # Notifications
    await db.notifications.insert_many([
        {"id": str(uuid.uuid4()), "title": "Welcome to School!",
         "message": "Welcome to the new academic year 2026. Wishing everyone success!",
         "type": "announcement", "audience": "all", "created_at": now, "read_by": []},
        {"id": str(uuid.uuid4()), "title": "Fee Reminder",
         "message": "Term 2 fees are due by June 15. Please pay on time.",
         "type": "fee", "audience": "parent", "created_at": now, "read_by": []},
        {"id": str(uuid.uuid4()), "title": "Parent-Teacher Meeting",
         "message": "PTM scheduled for Saturday 10 AM in the main hall.",
         "type": "announcement", "audience": "all", "created_at": now, "read_by": []},
        {"id": str(uuid.uuid4()), "title": "Sports Day",
         "message": "Annual sports day on March 5. Participation mandatory.",
         "type": "general", "audience": "student", "created_at": now, "read_by": []},
    ])

    logger.info("Seed complete.")


# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def on_startup():
    await seed_data()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
