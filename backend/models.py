import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Date, ForeignKey, Text, Index,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


def _uuid():
    return str(uuid.uuid4())


def _now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "sch_users"
    id = Column(String(36), primary_key=True, default=_uuid)
    name = Column(String(200), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, index=True)  # admin/teacher/student/parent
    avatar = Column(Text, nullable=True)
    phone = Column(String(40), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class SchoolClass(Base):
    __tablename__ = "sch_classes"
    id = Column(String(36), primary_key=True, default=_uuid)
    name = Column(String(50), unique=True, nullable=False, index=True)  # "10-A"
    grade = Column(String(10), nullable=False)
    section = Column(String(10), nullable=False)
    teacher_id = Column(String(36), ForeignKey("sch_users.id", ondelete="SET NULL"), nullable=True, index=True)


class Student(Base):
    __tablename__ = "sch_students"
    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("sch_users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    roll_no = Column(String(50), nullable=False, index=True)
    class_name = Column(String(50), nullable=False, index=True)
    section = Column(String(10), nullable=False)
    parent_id = Column(String(36), ForeignKey("sch_users.id", ondelete="SET NULL"), nullable=True, index=True)
    avatar = Column(Text, nullable=True)
    phone = Column(String(40), nullable=True)


class Teacher(Base):
    __tablename__ = "sch_teachers"
    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("sch_users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    subject = Column(String(100), nullable=False)
    classes = Column(JSONB, nullable=False, default=list)  # list of class names
    avatar = Column(Text, nullable=True)


class Attendance(Base):
    __tablename__ = "sch_attendance"
    id = Column(String(36), primary_key=True, default=_uuid)
    student_id = Column(String(36), ForeignKey("sch_students.id", ondelete="CASCADE"), nullable=False, index=True)
    class_name = Column(String(50), nullable=False, index=True)
    date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    status = Column(String(20), nullable=False)  # present/absent/late
    marked_by = Column(String(36), nullable=False)
    marked_at = Column(DateTime(timezone=True), default=_now, nullable=False)

    __table_args__ = (
        Index("ix_sch_attendance_student_date", "student_id", "date", unique=True),
    )


class Fee(Base):
    __tablename__ = "sch_fees"
    id = Column(String(36), primary_key=True, default=_uuid)
    student_id = Column(String(36), ForeignKey("sch_students.id", ondelete="CASCADE"), nullable=False, index=True)
    term = Column(String(50), nullable=False)
    amount = Column(Float, nullable=False)
    paid = Column(Float, nullable=False, default=0)
    due_date = Column(String(10), nullable=False)  # YYYY-MM-DD
    status = Column(String(20), nullable=False, default="pending", index=True)


class Payment(Base):
    __tablename__ = "sch_payments"
    id = Column(String(36), primary_key=True, default=_uuid)
    fee_id = Column(String(36), ForeignKey("sch_fees.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(String(36), ForeignKey("sch_students.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    method = Column(String(50), nullable=False, default="online")
    paid_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class TimetableSlot(Base):
    __tablename__ = "sch_timetable"
    id = Column(String(36), primary_key=True, default=_uuid)
    class_name = Column(String(50), nullable=False, index=True)
    day = Column(String(5), nullable=False, index=True)  # Mon-Fri
    period = Column(Integer, nullable=False)
    subject = Column(String(100), nullable=False)
    teacher_name = Column(String(200), nullable=False)
    time = Column(String(20), nullable=False)


class Exam(Base):
    __tablename__ = "sch_exams"
    id = Column(String(36), primary_key=True, default=_uuid)
    name = Column(String(100), nullable=False)
    class_name = Column(String(50), nullable=False, index=True)
    subject = Column(String(100), nullable=False)
    date = Column(String(10), nullable=False)
    max_marks = Column(Integer, nullable=False)


class Result(Base):
    __tablename__ = "sch_results"
    id = Column(String(36), primary_key=True, default=_uuid)
    exam_id = Column(String(36), ForeignKey("sch_exams.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(String(36), ForeignKey("sch_students.id", ondelete="CASCADE"), nullable=False, index=True)
    marks = Column(Float, nullable=False)
    grade = Column(String(5), nullable=False)


class Notification(Base):
    __tablename__ = "sch_notifications"
    id = Column(String(36), primary_key=True, default=_uuid)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(30), nullable=False, default="announcement")
    audience = Column(String(100), nullable=False, default="all", index=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    read_by = Column(JSONB, nullable=False, default=list)


class Leave(Base):
    __tablename__ = "sch_leaves"
    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("sch_users.id", ondelete="CASCADE"), nullable=False, index=True)
    user_name = Column(String(200), nullable=False)
    role = Column(String(20), nullable=False)
    from_date = Column(String(10), nullable=False)
    to_date = Column(String(10), nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="pending", index=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
