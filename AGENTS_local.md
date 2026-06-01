# 🤖 FocusFlow — Памятка локальной разработки (WSL2 + Docker)

> Этот файл — дополнение к `AGENTS.md`. Только практика, никакой теории.

## 🐚 Работа с shell

**Запомнить раз и навсегда:** PowerShell НЕ понимает `&&`. Используй `;` или запускай всё в WSL.

```powershell
# ❌ НЕ РАБОТАЕТ:
cd backend && alembic upgrade head

# ✅ РАБОТАЕТ:
Set-Location backend; alembic upgrade head

# ✅ ЛУЧШЕ: запускать команды через WSL
wsl cd backend && alembic upgrade head
```

## 🐳 Docker Compose для разработки

**Запуск и перезапуск:**

```powershell
# Полный старт:
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

# Перезапуск только бэкенда (быстрее):
docker compose -f docker-compose.yml -f docker-compose.dev.yml restart backend

# Перезапуск с пересборкой образа:
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build backend

# Просмотр логов:
docker compose logs --tail 50 backend
docker compose logs --tail 20 frontend
```

## 🗄 Миграции Alembic

### Проблема: pip timeout при сборке образа

Когда Docker собирает образ бэкенда, `pip install` может упасть с таймаутом (ReadTimeout).

**Решение — применить миграцию напрямую в работающем контейнере:**

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend alembic upgrade head
```

### Проблема: ENUM vs VARCHAR (⚠️ главный грабли!)

Когда поле модели — `Enum(str, Enum)`, SQLAlchemy может создать кастомный ENUM-тип в PostgreSQL при `create_all()`. Тогда обычный `SELECT` с `WHERE status = 'active'` упадёт с ошибкой:

```
UndefinedObjectError: type "goalstatus" does not exist
```

**Причина:** `create_all()` создал ENUM, а миграция через Alembic идёт с `AutoString()`. Разные типы → ошибка.

**Решение: всегда явно указывать `sa_type=String(...)` для Enum-полей:**

```python
# ✅ ПРАВИЛЬНО:
status: MyEnum = Field(
    nullable=False,
    default=MyEnum.VALUE,
    sa_type=String(20),  # ← всегда! не даёт SQLAlchemy создать ENUM
)

# ❌ НЕПРАВИЛЬНО (создаёт ENUM в БД):
status: MyEnum = Field(
    nullable=False,
    default=MyEnum.VALUE,
    # нет sa_type — SQLAlchemy сам решит, что это ENUM
)
```

**Список полей, где уже стоит `sa_type`:**
- `Goal.status` → `String(20)`
- `Project.status` → `String(20)`
- `Project.project_type` → `String(20)`

**Если ошибка уже случилась — чинить так:**

```powershell
# 1. Удалить таблицу
docker compose exec postgres psql -U focusflow -d focusflow_db -c "DROP TABLE IF EXISTS <table> CASCADE;"

# 2. Удалить ENUM-тип (если создался)
docker compose exec postgres psql -U focusflow -d focusflow_db -c "DROP TYPE IF EXISTS <enum_name>;"

# 3. Исправить модель (добавить sa_type=String(...))

# 4. Перезапустить бэкенд (чтобы перезагрузил модели)
docker compose -f docker-compose.yml -f docker-compose.dev.yml restart backend

# 5. Пересоздать таблицу
docker compose exec backend python -c "
import asyncio
from sqlmodel import SQLModel
from db.session import async_engine
from models import *
asyncio.run(SQLModel.metadata.create_all(async_engine))
"
```

## 🔄 Volumes в dev-режиме

В `docker-compose.dev.yml` бэкенд использует **bind mount** `./backend/src:/app/src`.

**Что это значит:**
- Код меняется на лету → не нужно пересобирать образ
- НО: контейнер не знает о новых файлах, пока не перезапущен
- Если создаёшь новый файл (модель, endpoint) — нужен `restart backend`

```powershell
# После добавления нового файла в src/:
docker compose -f docker-compose.yml -f docker-compose.dev.yml restart backend
```

## 🌐 Доступ к API

**Из браузера на хосте:** `http://localhost:5173/api/...` (Vite проксирует на backend)

**Изнутри контейнера (для curl-тестов):**
```powershell
docker compose exec backend curl -s http://localhost:8000/api/health
```

**PowerShell ломает JSON!** Не пытайся передавать JSON через `-d` в curl внутри PowerShell.
```powershell
# ❌ НЕ РАБОТАЕТ:
docker compose exec backend curl -X POST ... -d '{"key":"value"}'

# ✅ РАБОТАЕТ (sh -c):
docker compose exec backend sh -c 'curl -X POST ... -d "{\"key\":\"value\"}"'

# ✅ ЛУЧШЕ: использовать Python внутри контейнера:
docker compose exec backend python -c "
import urllib.request, json
req = urllib.request.Request('http://localhost:8000/api/...', 
    data=json.dumps({...}).encode(), 
    headers={'Content-Type': 'application/json'})
print(urllib.request.urlopen(req).read().decode())
"
```

## 🔧 Быстрый сброс БД при проблемах

```powershell
# Полный сброс (если всё сломалось):
docker compose down postgres
docker compose up -d postgres

# Или удалить все таблицы и пересоздать:
docker compose exec backend python -m src.db.init_db --reset --create
```

## ✅ Чеклист при добавлении новой модели

- [ ] Модель наследуется от `UserOwnedModel` (бизнес-сущности) или `BaseModel` (системные)
- [ ] У полей-перечислений (Enum) обязательно стоит `sa_type=String(N)`
- [ ] Модель зарегистрирована в `backend/src/models/__init__.py`
- [ ] Эндпоинт зарегистрирован в `backend/src/main.py`
- [ ] Создана миграция через `alembic revision --autogenerate`
- [ ] Если autogenerate не сработал — написать миграцию вручную
- [ ] Перезапущен бэкенд после добавления новых файлов
- [ ] Применена миграция на работающем контейнере

## 🚫 Типичные ошибки (шпаргалка)

| Симптом | Причина | Решение |
|---|---|---|
| `SIGBUS` при `npm run dev` в Docker | Проблема node_modules на WSL | `docker compose down`, удалить volume, `up --build` |
| `ModuleNotFoundError: models.project` | Новый файл создан, но контейнер не перезагружен | `restart backend` |
| `type "goalstatus" does not exist` | Enum-поле без `sa_type` | Добавить `sa_type=String(20)`, сбросить таблицу |
| `AttributeError: 'str' object has no attribute 'value'` | refresh вернул строку вместо Enum | Проверить `isinstance(..., str) else .value` |
| `pip install` таймаут при билде | Проблемы сети | Использовать `exec backend alembic upgrade head` вместо пересборки |
