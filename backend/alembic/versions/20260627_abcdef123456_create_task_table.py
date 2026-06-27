"""create task table

Revision ID: abcdef123456
Revises: 8459614464b5
Create Date: 2026-06-27 14:25:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'abcdef123456'
down_revision: Union[str, None] = '8459614464b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Применяет миграцию: создаёт таблицы task_statuses и tasks."""
    # ── Справочник статусов задачи ──────────────────
    op.create_table('task_statuses',
    sa.Column('id', sa.Integer(), autoincrement=False, nullable=False),
    sa.Column('code', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
    sa.Column('name', sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.Column('color', sqlmodel.sql.sqltypes.AutoString(length=7), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_task_statuses_code'), 'task_statuses', ['code'], unique=True)
    op.create_index(op.f('ix_task_statuses_created_at'), 'task_statuses', ['created_at'], unique=False)

    # Seed: статусы задачи (1-активна, 2-выполнена, 3-отменена)
    op.execute("""
        INSERT INTO task_statuses (id, code, name, sort_order, color, created_at, updated_at) VALUES
        (1, 'active',    'Активна',    1, '#22c55e', NOW(), NOW()),
        (2, 'completed', 'Выполнена',  2, '#3b82f6', NOW(), NOW()),
        (3, 'cancelled', 'Отменена',   3, '#ef4444', NOW(), NOW())
    """)

    # ── Таблица задач ───────────────────────────────
    op.create_table('tasks',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('sphere_id', sa.Uuid(), nullable=False),
    sa.Column('project_id', sa.Uuid(), nullable=True),
    sa.Column('goal_id', sa.Uuid(), nullable=True),
    sa.Column('title', sqlmodel.sql.sqltypes.AutoString(length=500), nullable=False),
    sa.Column('description', sqlmodel.sql.sqltypes.AutoString(length=5000), nullable=True),
    sa.Column('is_appointment', sa.Boolean(), nullable=False),
    sa.Column('start_date', sa.DateTime(timezone=True), nullable=False),
    sa.Column('finish_date', sa.DateTime(timezone=True), nullable=False),
    sa.Column('appointment_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('travel_time', sa.Integer(), nullable=True),
    sa.Column('duration', sa.Integer(), nullable=False),
    sa.Column('importance', sa.Integer(), nullable=False),
    sa.Column('consequences', sa.Integer(), nullable=False),
    sa.Column('progress', sa.Integer(), nullable=False),
    sa.Column('delay_to', sa.DateTime(timezone=True), nullable=True),
    sa.Column('refusal_count', sa.Integer(), nullable=False),
    sa.Column('status_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['goal_id'], ['goals.id'], ),
    sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
    sa.ForeignKeyConstraint(['sphere_id'], ['spheres.id'], ),
    sa.ForeignKeyConstraint(['status_id'], ['task_statuses.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_tasks_created_at'), 'tasks', ['created_at'], unique=False)
    op.create_index(op.f('ix_tasks_goal_id'), 'tasks', ['goal_id'], unique=False)
    op.create_index(op.f('ix_tasks_id'), 'tasks', ['id'], unique=False)
    op.create_index(op.f('ix_tasks_project_id'), 'tasks', ['project_id'], unique=False)
    op.create_index(op.f('ix_tasks_sphere_id'), 'tasks', ['sphere_id'], unique=False)
    op.create_index(op.f('ix_tasks_status_id'), 'tasks', ['status_id'], unique=False)
    op.create_index(op.f('ix_tasks_title'), 'tasks', ['title'], unique=False)
    op.create_index(op.f('ix_tasks_user_id'), 'tasks', ['user_id'], unique=False)


def downgrade() -> None:
    """Откатывает миграцию: удаляет таблицы tasks и task_statuses."""
    op.drop_index(op.f('ix_tasks_user_id'), table_name='tasks')
    op.drop_index(op.f('ix_tasks_title'), table_name='tasks')
    op.drop_index(op.f('ix_tasks_status_id'), table_name='tasks')
    op.drop_index(op.f('ix_tasks_sphere_id'), table_name='tasks')
    op.drop_index(op.f('ix_tasks_project_id'), table_name='tasks')
    op.drop_index(op.f('ix_tasks_id'), table_name='tasks')
    op.drop_index(op.f('ix_tasks_goal_id'), table_name='tasks')
    op.drop_index(op.f('ix_tasks_created_at'), table_name='tasks')
    op.drop_table('tasks')
    op.drop_index(op.f('ix_task_statuses_created_at'), table_name='task_statuses')
    op.drop_index(op.f('ix_task_statuses_code'), table_name='task_statuses')
    op.drop_table('task_statuses')
