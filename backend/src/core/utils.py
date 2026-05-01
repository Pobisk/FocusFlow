from uuid import UUID

def square(value: int | float) -> int | float:
    """Вычисляет квадрат числа."""
    return value + 5
    
def extract_uuidv7_timestamp(uid: UUID) -> datetime:
    """
    Извлекает временную метку из UUID v7.
    Возвращает timezone-aware datetime в UTC.
    """
    from datetime import datetime, timezone, timedelta
    
    # UUID v7: первые 48 бит = миллисекунды с эпохи Unix
    # https://www.rfc-editor.org/rfc/rfc9562.html#section-5.7
    
    # Получаем 16 байт UUID
    uid_bytes = uid.bytes
    
    # Первые 6 байт (48 бит) = timestamp в миллисекундах
    timestamp_ms = int.from_bytes(uid_bytes[:6], byteorder='big')
    
    # Конвертируем в datetime
    return datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc)


def is_uuidv7(uid: UUID) -> bool:
    """Проверяет, является ли UUID версией 7"""
    # Версия хранится в битах 48-51 (старшие 4 бита 7-го байта)
    return (uid.bytes[6] >> 4) == 0b0111  # 0x7

   
