"""JWT utilities for authentication."""

import jwt
from datetime import datetime, timedelta, timezone

from core.config import settings

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 6


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Создать JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(hours=JWT_EXPIRE_HOURS)
    )
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
    })
    return jwt.encode(to_encode, settings.secret_key, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    """Декодировать и валидировать JWT token."""
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None
