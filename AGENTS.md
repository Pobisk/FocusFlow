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

### 📅 Работа с датами и временем (упрощённый подход)

#### Принцип
- **Все даты хранятся в БД как `TIMESTAMPTZ` (UTC)**.
- **"Даты без времени"** — это `00:00:00` в часовом поясе **браузера пользователя**, сконвертированное в UTC перед отправкой.
- **Бэкенд не знает о часовых поясах**: принимает и отдаёт только UTC, не хранит `user_timezone`.
- **Фронтенд отвечает за локализацию**: берёт таймзону из `Intl.DateTimeFormat().resolvedOptions().timeZone`.

#### Backend (Python)
- Тип: `datetime.datetime` с `tzinfo=timezone.utc` (никогда не `naive`!)
- Поле SQLModel: `sa_column=Column(DateTime(timezone=True))`
- Валидация: парсить ISO-строки с 'Z' → `datetime.fromisoformat(value.replace('Z', '+00:00'))`
- Сериализация: всегда в формате `"YYYY-MM-DDTHH:MM:SSZ"` (ISO 8601, UTC)
- ❌ Не передавать и не принимать `user_timezone` в запросах
- ❌ Не делать конвертацию в локальные пояса на бэкенде

#### Frontend (TypeScript)
- Получение таймзоны: `Intl.DateTimeFormat().resolvedOptions().timeZone`
- Библиотеки: `date-fns` + `date-fns-tz` для конвертации и форматирования
- Отправка "дат без времени":
  ```ts
  dateOnlyToUTC("2026-05-04") → "2026-05-03T21:00:00Z" (для Москвы)
- Отображение:
  ```ts
  utcToDateOnly("2026-05-03T21:00:00Z") → "04.05.2026" (для Москвы)
  formatDateTimeLocal("2026-05-05T12:20:37Z") → "среда 05.05.2026 15:20"
- Все сравнения интервалов на фронте — в UTC (через new Date().getTime())

#### Поиск и сравнение
- Все интервалы сравниваются в UTC: start_a < end_b AND end_a > start_b
- PostgreSQL: используйте tstzrange() и GiST-индексы для пересечений
- На фронте: intervalsOverlap() работает с ISO-строками UTC

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
