"""add_user_model

Revision ID: be79598f2482
Revises: 
Create Date: 2026-05-28 16:29:51.874809+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'be79598f2482'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Применяет миграцию: создаёт таблицу users."""
    op.create_table('users',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('login', sa.String(length=100), nullable=False),
    sa.Column('hash', sa.String(length=64), nullable=False),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('login')
    )
    op.create_index('ix_users_login', 'users', ['login'], unique=False)


def downgrade() -> None:
    """Откатывает миграцию: удаляет таблицу users."""
    op.drop_index('ix_users_login', table_name='users')
    op.drop_table('users')
