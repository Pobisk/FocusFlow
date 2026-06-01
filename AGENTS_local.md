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
- [ ] Для полей-справочников (status, type) создана справочная таблица с Integer PK
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
| `type "goalstatus" does not exist` | SQLAlchemy создал ENUM вместо справочной таблицы | Использовать Integer FK, а не `sa_type=String` |
| `AttributeError: 'str' object has no attribute 'value'` | refresh вернул строку вместо Enum | Проверить `isinstance(..., str) else .value` |
| `pip install` таймаут при билде | Проблемы сети | Использовать `exec backend alembic upgrade head` вместо пересборки |
