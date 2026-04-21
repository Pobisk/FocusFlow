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
- **Framework**: FastAPI (авто-генерация OpenAPI)
- **ORM**: SQLModel (SQLAlchemy 2.0 + Pydantic v2)
- **Миграции**: Alembic (авто-генерация через `alembic revision --autogenerate`)
- **Шедулер**: APScheduler (задачи < 10 сек). Для тяжёлых задач — использовать Celery.
- **Типизация**: Строгая. Запрещено: `Any`, `dict`, `**kwargs` без обоснования.
- **Ошибки**: Только через `HTTPException(status_code, detail={...})`.
- **S3**: Использовать **pre-signed URLs**. Никогда не проксировать файлы через бэк.
- **БД**: PostgreSQL 16, JSONB для гибких настроек.

### Frontend (TypeScript strict)
- **Framework**: Next.js 14 App Router (Server Components по умолчанию)
- **Стилизация**: Tailwind CSS + shadcn/ui (готовые компоненты)
- **API-клиент**: Генерировать из `openapi.json` через `openapi-typescript`. Не писать ручные fetch.
- **Адаптив**: Mobile-first. Тестировать на 320px, 768px, 1440px.
- **Загрузка файлов**: Использовать pre-signed URL с бэка → загрузка напрямую в S3.

### Инфраструктура
- **Контейнеризация**: Docker + Docker Compose (один VPS)
- **Proxy/HTTPS**: Caddy (авто-сертификаты Let's Encrypt)
- **Бэкапы**: `pg_dump` раз в 24ч в `/backups` (монтируется в volume)
- **Секреты**: Только через `.env` файл. Никогда не коммитить `.env` в репо.

## 🚫 Запрещено
- ❌ `eval()`, `exec()`, динамические импорты без веской причины
- ❌ Хардкод секретов, URL, токенов
- ❌ Игнорирование типов (`any`, `# type: ignore`)
- ❌ Проксирование файлов через backend (только pre-signed URLs)
- ❌ Изменение структуры `docker-compose.yml` без согласования

## 🔄 Рабочий процесс с ИИ
1. Перед генерацией кода: прочитать `AGENTS.md` и соответствующие `pyproject.toml` / `package.json`
2. После генерации: запустить линтеры (`ruff`, `eslint`) и тип-чекеры (`pyright`, `tsc --noEmit`)
3. Для новых эндпоинтов: обновить `openapi.json` → перегенерировать TS-клиент
4. Коммиты: использовать конвенцию `feat:`, `fix:`, `chore:`, `refactor:`

## 🧪 Тестирование
- Бэкенд: `pytest` с фикстурами для БД (test-база)
- Фронтенд: `vitest` + `@testing-library/react`
- E2E: `playwright` (опционально, для критичных сценариев)

## 📦 Зависимости
- Бэкенд: `pyproject.toml` + `uv` или `pip-tools` для детерминированных версий
- Фронтенд: `package.json` + `pnpm` (предпочтительно) или `npm`

> 💡 Совет: Если ИИ предлагает сложное решение — спросить: «Можно ли это сделать проще, используя встроенные возможности FastAPI/Next.js?»
