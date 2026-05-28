# 🤖 FocusFlow — Инструкции для ИИ-агентов

> Этот файл задаёт контекст и правила для всех LLM/Copilot/Cursor/Devin, работающих с репозиторием.

## 📋 Проект

**FocusFlow** — личный помощник для фокусировки на целях.  
Функции: анализ данных, планирование задач, рассылка уведомлений, хранение файлов.

## 🏗 Архитектура

/ (root)
├── backend/ # FastAPI + SQLModel + APScheduler
├── frontend/ # Next.js 14 App Router + TypeScript + Tailwind
├── docker-compose.yml
├── Caddyfile
└── AGENTS.md # ← Вы здесь



## ⚙️ Стек и правила кода

### Backend (Python 3.12+)

* **Framework**: FastAPI (авто-генерация OpenAPI)
* **ORM**: SQLModel (SQLAlchemy 2.0 + Pydantic v2)
* **Миграции**: Alembic (авто-генерация через `alembic revision --autogenerate`)
* **Шедулер**: APScheduler (задачи < 10 сек). Для тяжёлых задач — использовать Celery.
* **Типизация**: Строгая. Запрещено: `Any`, `dict`, `\*\*kwargs` без обоснования.
* **Ошибки**: Только через `HTTPException(status\_code, detail={...})`.
* **S3**: Использовать **pre-signed URLs**. Никогда не проксировать файлы через бэк.
* **БД**: PostgreSQL 16, JSONB для гибких настроек.

### Frontend (TypeScript strict)

* **Framework**: Vite + React 18 (SPA, без SSR/SEO)
* **Роутинг**: react-router-dom v6
* **Стилизация**: Tailwind CSS + shadcn/ui (готовые компоненты)
* **API-клиент**: Генерировать из `openapi.json` через `openapi-typescript`. Не писать ручные fetch.
* **Работа с API**: @tanstack/react-query (кэширование, ревалидация)
* **Даты**: date-fns + date-fns-tz
* **Адаптив**: Mobile-first. Тестировать на 320px, 768px, 1440px.
* **Загрузка файлов**: Использовать pre-signed URL с бэка → загрузка напрямую в S3.
* **Оффлайн (будущее)**: vite-plugin-pwa для Service Worker

### Инфраструктура

* **Контейнеризация**: Docker + Docker Compose (один VPS)
* **Proxy/HTTPS**: Caddy (авто-сертификаты Let's Encrypt)
* **Бэкапы**: `pg\_dump` раз в 24ч в `/backups` (монтируется в volume)
* **Секреты**: Только через `.env` файл. Никогда не коммитить `.env` в репо.

### ⚡ UUID Rules (AI Guidelines)

#### 🎯 Core Rules

```yaml
Primary Key: UUID v7 (never int, never string)
Inheritance:
  - `BaseModel` — только для системных/вспомогательных сущностей (напр. User)
  - `UserOwnedModel` — для всех бизнес-сущностей (Sphere, Goal, Project, Action и т.д.)
Package: uuid6==2024.7.10
Import: from uuid6 import uuid7
Migration Type: sa.Uuid() (NEVER sa.String())
```

#### ✅ DO: Create Business Model (наследуется от UserOwnedModel)

```python
# backend/src/models/your\_model.py
from models.base import UserOwnedModel  # ← Provides: id (UUID v7), created\_at, updated\_at, user\_id
from sqlmodel import Field
from uuid import UUID

class YourModel(UserOwnedModel, table=True):  # ← table=True is required
    # ✅ id, user\_id, created\_at, updated\_at — все унаследованы, не объявлять!
    name: str = Field(max\_length=100, index=True)
    # Для внешних ключей на другие бизнес-сущности:
    parent\_id: UUID | None = Field(default=None, foreign\_key="other\_models.id", index=True)
```

#### ✅ DO: Create System Model (только если нет привязки к пользователю)

```python
# backend/src/models/your\_model.py
from models.base import BaseModel  # ← Только для системных сущностей без user\_id

class SystemEntity(BaseModel, table=True):
    """Системная сущность, не привязанная к пользователю."""
    name: str = Field(max\_length=100, index=True)
```

#### ✅ DO: Migration File

```python
# alembic/versions/xxx\_create\_your\_model.py
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID  # ← For clarity

def upgrade():
    op.create\_table(
        "your\_model",
        sa.Column("id", sa.Uuid(), nullable=False),  # ✅ CORRECT: 16 bytes, native type
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("owner\_id", sa.Uuid(), nullable=False),  # ✅ Foreign key also UUID
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(\["user\_id"], \["users.id"], ondelete="CASCADE"),
    )
```

#### ❌ DON'T: Common Mistakes

```python
# ❌ Never declare id manually:
class YourModel(UserOwnedModel, table=True):
    id: UUID = Field(...)  # ← WRONG: already in UserOwnedModel

# ❌ Never use uuid4:
from uuid import uuid4  # ← WRONG: use uuid6 for time-ordered IDs

# ❌ Never use String for UUID in migrations:
sa.Column("id", sa.String(length=36))  # ← WRONG: 36 bytes, slow indexes

# ❌ Never forget table=True:
class YourModel(UserOwnedModel):  # ← WRONG: missing table=True → not registered in DB
```

### 📅 Работа с датами и временем (упрощённый подход)

#### Принцип

* **Все даты хранятся в БД как `TIMESTAMPTZ` (UTC)**.
* **"Даты без времени"** — это `00:00:00` в часовом поясе **браузера пользователя**, сконвертированное в UTC перед отправкой.
* **Бэкенд не знает о часовых поясах**: принимает и отдаёт только UTC, не хранит `user\_timezone`.
* **Фронтенд отвечает за локализацию**: берёт таймзону из `Intl.DateTimeFormat().resolvedOptions().timeZone`.

#### Backend (Python)

* Тип: `datetime.datetime` с `tzinfo=timezone.utc` (никогда не `naive`!)
* **Поле SQLModel**: использовать `sa_type=UTCDateTime` (см. памятку ниже)
* Валидация: парсить ISO-строки с 'Z' → `datetime.fromisoformat(value.replace('Z', '+00:00'))`
* Сериализация: всегда в формате `"YYYY-MM-DDTHH:MM:SSZ"` (ISO 8601, UTC)
* ❌ Не передавать и не принимать `user\_timezone` в запросах
* ❌ Не делать конвертацию в локальные пояса на бэкенде

#### 🧠 Памятка: как объявить datetime-поле в SQLModel

**Проблема:** SQLModel НЕ позволяет передавать `nullable`, `index`, `sa_column_kwargs` вместе с `sa_column`.
Использование `sa_column=Column(DateTime(timezone=True))` приводит к ошибкам при добавлении `nullable`, `index` или `onupdate`.

**Решение:** Использовать `sa_type=UTCDateTime` — кастомный тип из `models.base`, который всегда генерирует `TIMESTAMPTZ`.

```python
# backend/src/models/base.py — уже есть, ничего добавлять не нужно
from sqlalchemy import DateTime

class UTCDateTime(DateTime):
    """DateTime с timezone=True по умолчанию.
    
    Всегда хранит TIMESTAMPTZ в PostgreSQL.
    """
    def __init__(self, **kwargs: bool) -> None:
        super().__init__(timezone=True, **kwargs)
```

##### ✅ DO: datetime-поле в модели

```python
from datetime import datetime, timezone
from sqlmodel import Field
from models.base import BaseModel, UTCDateTime  # UTCDateTime уже импортирован

class MyModel(BaseModel, table=True):
    # created_at и updated_at уже есть в BaseModel — не объявлять!
    
    # Для дополнительных datetime-полей:
    changed_at: datetime = Field(
        nullable=False,
        sa_type=UTCDateTime,              # ✅ Генерирует TIMESTAMPTZ
        description="Дата и время изменения",
    )
```

##### ✅ Миграция (autogenerate)

Alembic autogenerate сам подхватит `sa.DateTime(timezone=True)`.
Если в сгенерированной миграции появилось `models.base.UTCDateTime()` — замените на `sa.DateTime(timezone=True)` вручную.

```python
# ✅ CORRECT: в миграции всегда пишем sa.DateTime(timezone=True)
sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False),
```

##### ❌ Чего НЕ делать

```python
# ❌ Никогда не использовать sa_column с DateTime:
created_at: datetime = Field(
    sa_column=Column(DateTime(timezone=True), nullable=False),  # ← ОШИБКА: нельзя добавить index, onupdate
)

# ❌ Никогда не использовать sa_column_kwargs={"type_": ...}:
created_at: datetime = Field(
    sa_column_kwargs={"type_": DateTime(timezone=True)},  # ← ОШИБКА: "May not pass type_ positionally and as a keyword"
)

# ❌ Никогда не забывать timezone=True:
created_at: datetime = Field(default_factory=...)  # ← ОШИБКА: будет TIMESTAMP WITHOUT TIME ZONE
```

#### Frontend (TypeScript)

* Получение таймзоны: `Intl.DateTimeFormat().resolvedOptions().timeZone`
* Библиотеки: `date-fns` + `date-fns-tz` для конвертации и форматирования
* Отправка "дат без времени":

```ts
  dateOnlyToUTC("2026-05-04") → "2026-05-03T21:00:00Z" (для Москвы)
```

* Отображение:

```ts
  utcToDateOnly("2026-05-03T21:00:00Z") → "04.05.2026" (для Москвы)
  formatDateTimeLocal("2026-05-05T12:20:37Z") → "среда 05.05.2026 15:20"
```

* Все сравнения интервалов на фронте — в UTC (через new Date().getTime())

#### Поиск и сравнение

* Все интервалы сравниваются в UTC: start\_a < end\_b AND end\_a > start\_b
* PostgreSQL: используйте tstzrange() и GiST-индексы для пересечений
* На фронте: intervalsOverlap() работает с ISO-строками UTC

## 🚫 Запрещено

* ❌ `eval()`, `exec()`, динамические импорты без веской причины
* ❌ Хардкод секретов, URL, токенов
* ❌ Игнорирование типов (`any`, `# type: ignore`)
* ❌ Проксирование файлов через backend (только pre-signed URLs)
* ❌ Изменение структуры `docker-compose.yml` без согласования

## 🔄 Рабочий процесс с ИИ

1. Перед генерацией кода: прочитать `AGENTS.md` и соответствующие `pyproject.toml` / `package.json`
2. После генерации: запустить линтеры (`ruff`, `eslint`) и тип-чекеры (`pyright`, `tsc --noEmit`)
3. Для новых эндпоинтов: обновить `openapi.json` → перегенерировать TS-клиент
4. Коммиты: использовать конвенцию `feat:`, `fix:`, `chore:`, `refactor:`

## 🧪 Тестирование

* Бэкенд: `pytest` с фикстурами для БД (test-база)
* Фронтенд: `vitest` + `@testing-library/react`
* E2E: `playwright` (опционально, для критичных сценариев)

## 📦 Зависимости

* Бэкенд: `pyproject.toml` + `uv` или `pip-tools` для детерминированных версий
* Фронтенд: `package.json` + `pnpm` (предпочтительно) или `npm`

> 💡 Совет: Если ИИ предлагает сложное решение — спросить: «Можно ли это сделать проще, используя встроенные возможности FastAPI/Next.js?»

