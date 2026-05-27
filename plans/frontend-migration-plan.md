# План миграции фронтенда: Next.js → Vite + React + TypeScript

## Обоснование

Проект — **чистое SPA** без потребности в SEO, SSR или Server Components.
Next.js 14 App Router добавляет избыточную сложность без выгоды.
Vite даёт: меньший бандл, быстрее сборку, проще конфигурацию,
и нативный PWA-плагин для будущего оффлайн-режима.

---

## 1. Создание Vite-проекта

**Что сделать:**
- Инициализировать новый Vite-проект в `frontend/` с шаблоном `react-ts`
- Настроить `tsconfig.json` (strict mode, path aliases)
- Установить зависимости:
  - `react-router-dom` (роутинг SPA)
  - `@tanstack/react-query` (работа с API)
  - `tailwindcss`, `postcss`, `autoprefixer`
  - `shadcn/ui` (инициализация)
  - `date-fns`, `date-fns-tz`
  - `openapi-typescript`, `openapi-typescript-codegen` (генерация API-клиента)
  - `vite-plugin-pwa` (для будущего оффлайна)

**Затрагиваемые файлы:**
- `frontend/package.json` — полная замена
- `frontend/vite.config.ts` — новый
- `frontend/tsconfig.json` — новый
- `frontend/tsconfig.node.json` — новый
- `frontend/postcss.config.js` — новый
- `frontend/tailwind.config.ts` — новый
- `frontend/index.html` — новый (вместо `app/layout.js`)
- `frontend/src/main.tsx` — точка входа

---

## 2. Перенос существующего кода

**Что сделать:**
- Перенести `LoginForm.js` → `src/components/LoginForm.tsx` с типизацией
- Перенести `page.js` (главная) → `src/pages/LoginPage.tsx`
- Перенести `workspace/page.js` → `src/pages/WorkspacePage.tsx`
- Создать `src/lib/sha256.ts` (из существующего `@/lib/sha256`)
- Создать `src/lib/api.ts` (из существующего `@/lib/api`)
- Создать `src/lib/auth.ts` — хранение токена, проверка авторизации
- Создать `src/App.tsx` — корневой компонент с роутингом
- Создать `src/router.tsx` — конфигурация маршрутов

**Маршруты:**
| Путь | Компонент | Описание |
|------|-----------|----------|
| `/` | `LoginPage` | Главная с формой входа |
| `/workspace` | `WorkspacePage` | Рабочий экран (защищённый) |

**Защита маршрутов:**
- Компонент `ProtectedRoute`, проверяющий наличие `access_token` в `localStorage`
- При отсутствии токена — редирект на `/`

---

## 3. Генерация API-клиента из OpenAPI

**Что сделать:**
- Запустить бэкенд, получить `/api/openapi.json`
- Сгенерировать TypeScript-клиент через `openapi-typescript`
- Разместить в `src/api/generated/`
- Настроить `@tanstack/react-query` с автоматической подстановкой JWT-токена

**Затрагиваемые файлы:**
- `src/api/generated/` — автоматически сгенерированные типы и клиент
- `src/api/client.ts` — настроенный экземпляр `fetch` с токеном
- `src/hooks/useAuth.ts` — хук для авторизации
- `src/hooks/useSpheres.ts` — хук для работы со сферами

---

## 4. Настройка Tailwind + shadcn/ui

**Что сделать:**
- Инициализировать `shadcn/ui` через `npx shadcn@latest init`
- Настроить тему (спокойные рабочие тона, большие шрифты — согласно `doc/5`)
- Добавить базовые компоненты: `Button`, `Input`, `Card`, `Badge`, `Dialog`

**Цветовая схема (согласно требованиям):**
- Спокойные рабочие тона, без ярких цветов
- Большие, удобно читаемые шрифты
- Mobile-first: 320px, 768px, 1440px

---

## 5. Обновление Docker-инфраструктуры

### 5.1. `frontend/Dockerfile` — полная замена

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 5.2. `frontend/nginx.conf` — новый файл

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    
    # SPA fallback — все маршруты на index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Прокси API на бэкенд
    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 5.3. `docker-compose.yml` — обновление сервиса `frontend`

- Изменить образ с `next start` на `nginx`
- Убрать `NEXT_PUBLIC_*` переменные (больше не нужны)
- Порт остаётся 80 (Caddy проксирует)
- Уменьшить лимит памяти (nginx легче next)

### 5.4. `docker-compose.dev.yml` — обновление dev-сервиса

- Заменить `next dev` на `vite dev --host`
- Пробросить порт 5173 (Vite по умолчанию)
- Настроить Vite proxy для API на `http://backend:8000`

---

## 6. Удаление старого кода Next.js

**Что удалить:**
- `frontend/app/` — весь каталог (App Router)
- `frontend/components/` — старые компоненты (перенесены в `src/components/`)
- `frontend/public/` — содержимое перенести в `public/` нового проекта
- `frontend/next.config.js`
- `frontend/jsconfig.json`

---

## 7. Проверка и тестирование

**Что сделать:**
- `npm run build` — успешная сборка
- `npm run dev` — запуск dev-сервера
- Проверить маршруты: `/` → форма логина, `/workspace` → рабочий экран
- Проверить авторизацию: логин → редирект на `/workspace`
- Проверить защиту: без токена → редирект на `/`
- `docker compose build frontend` — успешная сборка Docker-образа

---

## Порядок выполнения (для режима Code)

| № | Шаг | Описание |
|---|-----|----------|
| 1 | Инициализация Vite | `npm create vite@latest frontend -- --template react-ts`, установка зависимостей |
| 2 | Настройка Tailwind | `npx tailwindcss init -p`, настройка `tailwind.config.ts` |
| 3 | Настройка shadcn/ui | `npx shadcn@latest init`, добавление компонентов |
| 4 | Создание структуры | `src/pages/`, `src/components/`, `src/lib/`, `src/hooks/`, `src/api/` |
| 5 | Роутинг | `react-router-dom`, `ProtectedRoute`, конфигурация маршрутов |
| 6 | Перенос кода | LoginForm, страницы, утилиты (sha256, api) |
| 7 | Генерация API-клиента | `openapi-typescript` из `/api/openapi.json` |
| 8 | Docker | Новый `Dockerfile`, `nginx.conf`, обновление `docker-compose*.yml` |
| 9 | Очистка | Удаление старого кода Next.js |
| 10 | Проверка | Сборка, dev-сервер, авторизация, Docker |

---

## Что НЕ меняется

- **Бэкенд** — остаётся без изменений (FastAPI + SQLModel)
- **База данных** — PostgreSQL 16, миграции Alembic
- **Инфраструктура** — Caddy, Docker Compose, MinIO
- **AGENTS.md** — только секция про фронтенд (заменить Next.js на Vite)
