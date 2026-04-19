"""homework module

Revision ID: d4f1b7c88d22
Revises: c3e0a4b9c101
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'd4f1b7c88d22'
down_revision = 'c3e0a4b9c101'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'sch_homework',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('subject', sa.String(length=100), nullable=True),
        sa.Column('class_name', sa.String(length=50), nullable=False),
        sa.Column('due_date', sa.String(length=10), nullable=False),
        sa.Column('attachment_url', sa.Text(), nullable=True),
        sa.Column('attachment_name', sa.String(length=300), nullable=True),
        sa.Column('created_by', sa.String(length=36), nullable=False),
        sa.Column('created_by_name', sa.String(length=200), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_sch_homework_class_name', 'sch_homework', ['class_name'])

    op.create_table(
        'sch_homework_submissions',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('homework_id', sa.String(length=36), nullable=False),
        sa.Column('student_id', sa.String(length=36), nullable=False),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('attachment_url', sa.Text(), nullable=True),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('grade', sa.String(length=10), nullable=True),
        sa.Column('feedback', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['homework_id'], ['sch_homework.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['student_id'], ['sch_students.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_sch_hw_sub_hw', 'sch_homework_submissions', ['homework_id'])
    op.create_index('ix_sch_hw_sub_student', 'sch_homework_submissions', ['student_id'])


def downgrade() -> None:
    op.drop_table('sch_homework_submissions')
    op.drop_table('sch_homework')
