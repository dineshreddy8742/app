"""scholara initial schema

Revision ID: 62b4bdb061fe
Revises: 
Create Date: 2026-04-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '62b4bdb061fe'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'sch_users',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('avatar', sa.Text(), nullable=True),
        sa.Column('phone', sa.String(length=40), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
    )
    op.create_index('ix_sch_users_email', 'sch_users', ['email'])
    op.create_index('ix_sch_users_role', 'sch_users', ['role'])

    op.create_table(
        'sch_classes',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('grade', sa.String(length=10), nullable=False),
        sa.Column('section', sa.String(length=10), nullable=False),
        sa.Column('teacher_id', sa.String(length=36), nullable=True),
        sa.ForeignKeyConstraint(['teacher_id'], ['sch_users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    op.create_index('ix_sch_classes_name', 'sch_classes', ['name'])
    op.create_index('ix_sch_classes_teacher_id', 'sch_classes', ['teacher_id'])

    op.create_table(
        'sch_students',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('roll_no', sa.String(length=50), nullable=False),
        sa.Column('class_name', sa.String(length=50), nullable=False),
        sa.Column('section', sa.String(length=10), nullable=False),
        sa.Column('parent_id', sa.String(length=36), nullable=True),
        sa.Column('avatar', sa.Text(), nullable=True),
        sa.Column('phone', sa.String(length=40), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['sch_users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['parent_id'], ['sch_users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
    )
    op.create_index('ix_sch_students_user_id', 'sch_students', ['user_id'])
    op.create_index('ix_sch_students_email', 'sch_students', ['email'])
    op.create_index('ix_sch_students_roll_no', 'sch_students', ['roll_no'])
    op.create_index('ix_sch_students_class_name', 'sch_students', ['class_name'])
    op.create_index('ix_sch_students_parent_id', 'sch_students', ['parent_id'])

    op.create_table(
        'sch_teachers',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('subject', sa.String(length=100), nullable=False),
        sa.Column('classes', postgresql.JSONB(), nullable=False),
        sa.Column('avatar', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['sch_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
    )
    op.create_index('ix_sch_teachers_user_id', 'sch_teachers', ['user_id'])
    op.create_index('ix_sch_teachers_email', 'sch_teachers', ['email'])

    op.create_table(
        'sch_attendance',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('student_id', sa.String(length=36), nullable=False),
        sa.Column('class_name', sa.String(length=50), nullable=False),
        sa.Column('date', sa.String(length=10), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('marked_by', sa.String(length=36), nullable=False),
        sa.Column('marked_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['student_id'], ['sch_students.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_sch_attendance_student_id', 'sch_attendance', ['student_id'])
    op.create_index('ix_sch_attendance_class_name', 'sch_attendance', ['class_name'])
    op.create_index('ix_sch_attendance_date', 'sch_attendance', ['date'])
    op.create_index('ix_sch_attendance_student_date', 'sch_attendance', ['student_id', 'date'], unique=True)

    op.create_table(
        'sch_fees',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('student_id', sa.String(length=36), nullable=False),
        sa.Column('term', sa.String(length=50), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('paid', sa.Float(), nullable=False),
        sa.Column('due_date', sa.String(length=10), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.ForeignKeyConstraint(['student_id'], ['sch_students.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_sch_fees_student_id', 'sch_fees', ['student_id'])
    op.create_index('ix_sch_fees_status', 'sch_fees', ['status'])

    op.create_table(
        'sch_payments',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('fee_id', sa.String(length=36), nullable=False),
        sa.Column('student_id', sa.String(length=36), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('method', sa.String(length=50), nullable=False),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['fee_id'], ['sch_fees.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['student_id'], ['sch_students.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_sch_payments_fee_id', 'sch_payments', ['fee_id'])
    op.create_index('ix_sch_payments_student_id', 'sch_payments', ['student_id'])

    op.create_table(
        'sch_timetable',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('class_name', sa.String(length=50), nullable=False),
        sa.Column('day', sa.String(length=5), nullable=False),
        sa.Column('period', sa.Integer(), nullable=False),
        sa.Column('subject', sa.String(length=100), nullable=False),
        sa.Column('teacher_name', sa.String(length=200), nullable=False),
        sa.Column('time', sa.String(length=20), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_sch_timetable_class_name', 'sch_timetable', ['class_name'])
    op.create_index('ix_sch_timetable_day', 'sch_timetable', ['day'])

    op.create_table(
        'sch_exams',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('class_name', sa.String(length=50), nullable=False),
        sa.Column('subject', sa.String(length=100), nullable=False),
        sa.Column('date', sa.String(length=10), nullable=False),
        sa.Column('max_marks', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_sch_exams_class_name', 'sch_exams', ['class_name'])

    op.create_table(
        'sch_results',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('exam_id', sa.String(length=36), nullable=False),
        sa.Column('student_id', sa.String(length=36), nullable=False),
        sa.Column('marks', sa.Float(), nullable=False),
        sa.Column('grade', sa.String(length=5), nullable=False),
        sa.ForeignKeyConstraint(['exam_id'], ['sch_exams.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['student_id'], ['sch_students.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_sch_results_exam_id', 'sch_results', ['exam_id'])
    op.create_index('ix_sch_results_student_id', 'sch_results', ['student_id'])

    op.create_table(
        'sch_notifications',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('type', sa.String(length=30), nullable=False),
        sa.Column('audience', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('read_by', postgresql.JSONB(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_sch_notifications_audience', 'sch_notifications', ['audience'])

    op.create_table(
        'sch_leaves',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('user_name', sa.String(length=200), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('from_date', sa.String(length=10), nullable=False),
        sa.Column('to_date', sa.String(length=10), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['sch_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_sch_leaves_user_id', 'sch_leaves', ['user_id'])
    op.create_index('ix_sch_leaves_status', 'sch_leaves', ['status'])


def downgrade() -> None:
    for t in [
        'sch_leaves', 'sch_notifications', 'sch_results', 'sch_exams',
        'sch_timetable', 'sch_payments', 'sch_fees', 'sch_attendance',
        'sch_teachers', 'sch_students', 'sch_classes', 'sch_users',
    ]:
        op.drop_table(t)
