"""create task_log (task_time_log) table

Revision ID: abcdef789012
Revises: abcdef123456
Create Date: 2026-06-27 18:10:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'abcdef789012'
down_revision: Union[str, None] = 'abcdef123456'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Применяет миграцию: создаёт таблицу task_time_log."""
    op.create_table('task_time_log',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('task_id', sa.Uuid(), nullable=False),
    sa.Column('log_date', sa.DateTime(timezone=True), nullable=False),
    sa.Column('minutes', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('task_id', 'user_id', 'log_date', name='uq_task_log_task_user_date'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ),
    )
    op.create_index(op.f('ix_task_time_log_created_at'), 'task_time_log', ['created_at'], unique=False)
    op.create_index(op.f('ix_task_time_log_id'), 'task_time_log', ['id'], unique=False)
    op.create_index(op.f('ix_task_time_log_task_id'), 'task_time_log', ['task_id'], unique=False)
    op.create_index(op.f('ix_task_time_log_user_id'), 'task_time_log', ['user_id'], unique=False)


def downgrade() -> None:
    """Откатывает миграцию: удаляет таблицу task_time_log."""
    op.drop_index(op.f('ix_task_time_log_user_id'), table_name='task_time_log')
    op.drop_index(op.f('ix_task_time_log_task_id'), table_name='task_time_log')
    op.drop_index(op.f('ix_task_time_log_id'), table_name='task_time_log')
    op.drop_index(op.f('ix_task_time_log_created_at'), table_name='task_time_log')
    op.drop_table('task_time_log')
