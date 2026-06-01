"""create goals table

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
    """Создаёт таблицу goals."""
    op.create_table('goals',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('sphere_id', sa.Uuid(), nullable=False),
        sa.Column('title', sqlmodel.sql.sqltypes.AutoString(length=300), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(length=2000), nullable=True),
        sa.Column('deadline', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default=sa.text("'active'")),
        sa.ForeignKeyConstraint(['sphere_id'], ['spheres.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_goals_created_at'), 'goals', ['created_at'], unique=False)
    op.create_index(op.f('ix_goals_id'), 'goals', ['id'], unique=False)
    op.create_index(op.f('ix_goals_user_id'), 'goals', ['user_id'], unique=False)
    op.create_index(op.f('ix_goals_sphere_id'), 'goals', ['sphere_id'], unique=False)
    op.create_index('ix_goals_user_sphere', 'goals', ['user_id', 'sphere_id'], unique=False)


def downgrade() -> None:
    """Удаляет таблицу goals."""
    op.drop_index('ix_goals_user_sphere', table_name='goals')
    op.drop_index(op.f('ix_goals_sphere_id'), table_name='goals')
    op.drop_index(op.f('ix_goals_user_id'), table_name='goals')
    op.drop_index(op.f('ix_goals_id'), table_name='goals')
    op.drop_index(op.f('ix_goals_created_at'), table_name='goals')
    op.drop_table('goals')
