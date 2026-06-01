"""create goal_tables (goal_statuses + goals with int FK)

Revision ID: xxxxxxxxxxxx
Revises: a8fe4146408a
Create Date: 2026-06-01 10:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'xxxxxxxxxxxx'
down_revision: Union[str, None] = 'a8fe4146408a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Создаёт справочник статусов и таблицу goals с Integer FK."""

    # ── 1. Справочник статусов цели ──────────────────
    op.create_table('goal_statuses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('color', sqlmodel.sql.sqltypes.AutoString(length=7), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_goal_statuses_code'), 'goal_statuses', ['code'], unique=True)
    op.create_index(op.f('ix_goal_statuses_id'), 'goal_statuses', ['id'], unique=False)

    # ── 2. Seed-данные для справочника ────────────────
    op.execute("""
        INSERT INTO goal_statuses (id, code, name, sort_order, color) VALUES
        (1, 'active',    'Активна',    1, '#22c55e'),
        (2, 'completed', 'Завершена',  2, '#3b82f6'),
        (3, 'cancelled', 'Отменена',   3, '#ef4444')
    """)

    # ── 3. Таблица целей ─────────────────────────────
    op.create_table('goals',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('sphere_id', sa.Uuid(), nullable=False),
        sa.Column('title', sqlmodel.sql.sqltypes.AutoString(length=300), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(length=2000), nullable=True),
        sa.Column('deadline', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status_id', sa.Integer(), nullable=False, server_default=sa.text('1')),
        sa.ForeignKeyConstraint(['sphere_id'], ['spheres.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['status_id'], ['goal_statuses.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_goals_created_at'), 'goals', ['created_at'], unique=False)
    op.create_index(op.f('ix_goals_id'), 'goals', ['id'], unique=False)
    op.create_index(op.f('ix_goals_user_id'), 'goals', ['user_id'], unique=False)
    op.create_index(op.f('ix_goals_sphere_id'), 'goals', ['sphere_id'], unique=False)
    op.create_index(op.f('ix_goals_status_id'), 'goals', ['status_id'], unique=False)
    op.create_index('ix_goals_user_sphere', 'goals', ['user_id', 'sphere_id'], unique=False)


def downgrade() -> None:
    """Удаляет таблицы goals и goal_statuses."""
    op.drop_index('ix_goals_user_sphere', table_name='goals')
    op.drop_index(op.f('ix_goals_status_id'), table_name='goals')
    op.drop_index(op.f('ix_goals_sphere_id'), table_name='goals')
    op.drop_index(op.f('ix_goals_user_id'), table_name='goals')
    op.drop_index(op.f('ix_goals_id'), table_name='goals')
    op.drop_index(op.f('ix_goals_created_at'), table_name='goals')
    op.drop_table('goals')
    op.drop_index(op.f('ix_goal_statuses_id'), table_name='goal_statuses')
    op.drop_index(op.f('ix_goal_statuses_code'), table_name='goal_statuses')
    op.drop_table('goal_statuses')
