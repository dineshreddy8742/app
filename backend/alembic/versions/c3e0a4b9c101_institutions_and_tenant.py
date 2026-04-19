"""institutions and tenant

Revision ID: c3e0a4b9c101
Revises: a2c9e7f12b01
"""
from alembic import op
import sqlalchemy as sa

revision = 'c3e0a4b9c101'
down_revision = 'a2c9e7f12b01'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'sch_institutions',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('type', sa.String(length=20), nullable=False),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('state', sa.String(length=100), nullable=True),
        sa.Column('country', sa.String(length=100), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('phone', sa.String(length=40), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('logo', sa.Text(), nullable=True),
        sa.Column('plan', sa.String(length=30), nullable=False, server_default='free'),
        sa.Column('active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.add_column('sch_users', sa.Column('institution_id', sa.String(length=36), nullable=True))
    op.create_index('ix_sch_users_institution_id', 'sch_users', ['institution_id'])


def downgrade() -> None:
    op.drop_index('ix_sch_users_institution_id', 'sch_users')
    op.drop_column('sch_users', 'institution_id')
    op.drop_table('sch_institutions')
