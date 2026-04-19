"""add attachments and materials

Revision ID: a2c9e7f12b01
Revises: 62b4bdb061fe
Create Date: 2026-04-19
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'a2c9e7f12b01'
down_revision = '62b4bdb061fe'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('sch_notifications', sa.Column('attachment_url', sa.Text(), nullable=True))
    op.add_column('sch_notifications', sa.Column('attachment_name', sa.String(length=300), nullable=True))
    op.add_column('sch_notifications', sa.Column('meeting_url', sa.Text(), nullable=True))

    op.create_table(
        'sch_materials',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('subject', sa.String(length=100), nullable=True),
        sa.Column('class_name', sa.String(length=50), nullable=True),
        sa.Column('file_url', sa.Text(), nullable=False),
        sa.Column('file_name', sa.String(length=300), nullable=True),
        sa.Column('file_type', sa.String(length=50), nullable=True),
        sa.Column('uploaded_by', sa.String(length=36), nullable=False),
        sa.Column('uploaded_by_name', sa.String(length=200), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_sch_materials_class_name', 'sch_materials', ['class_name'])


def downgrade() -> None:
    op.drop_table('sch_materials')
    op.drop_column('sch_notifications', 'meeting_url')
    op.drop_column('sch_notifications', 'attachment_name')
    op.drop_column('sch_notifications', 'attachment_url')
