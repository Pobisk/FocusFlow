# ТЗ-01: Авторизация

## 1. Цель модуля

Обеспечить аутентификацию пользователей по логину/паролю с выдачей JWT-токена. Все последующие запросы к API должны выполняться только с валидным токеном.

## 2. Зависимости

- Модуль не зависит от других модулей.
- Базовая модель `BaseModel` уже существует в `backend/src/models/base.py`.
- **Пользователь (User) — системная сущность, наследуется от `BaseModel` (не `UserOwnedModel`).**

## 3. Модель данных

### 3.1. User

Файл: `backend/src/models/user.py`

```python
from models.base import BaseModel
from sqlmodel import Field

class User(BaseModel, table=True):
    __tablename__ = "users"

    name: str = Field(nullable=False, max_length=200)
    login: str = Field(nullable=False, max_length=100, unique=True, index=True)
    hash: str = Field(nullable=False, max_length=64)  # SHA-256 hex
    active: bool = Field(nullable=False, default=True)
```

### 3.2. Миграция

Создать Alembic-миграцию через `alembic revision --autogenerate`.

Поля:
- `id` — `sa.Uuid()`, PK, not null
- `name` — `sa.String(200)`, not null
- `login` — `sa.String(100)`, not null, unique, index
- `hash` — `sa.String(64)`, not null
- `active` — `sa.Boolean()`, not null, default True
- `created_at` — `sa.DateTime(timezone=True)`, not null
- `updated_at` — `sa.DateTime(timezone=True)`, not null

### 3.3. Схемы Pydantic (запрос/ответ)

Файл: `backend/src/schemas/auth.py`

```python
from pydantic import BaseModel, Field

class LoginRequest(BaseModel):
    login: str = Field(..., min_length=3, max_length=100)
    hash: str = Field(..., min_length=64, max_length=64)  # SHA-256 hex

class LoginResponse(BaseModel):
    name: str
    access_token: str
```

## 4. Backend

### 4.1. Эндпоинт

Файл: `backend/src/api/endpoints/auth.py`

**POST /api/auth/login**

Вход: `LoginRequest` (login, hash)
Выход: `LoginResponse` (name, access_token)

Логика:
1. Ищем пользователя в БД по `login`.
2. Если не найден → `HTTPException(401, detail="Неверный логин или пароль")`.
3. Сравниваем `hash` из запроса с `user.hash`.
4. Если не совпадает → `HTTPException(401, detail="Неверный логин или пароль")`.
5. Проверяем `user.active`.
6. Если `active == False` → `HTTPException(403, detail="Пользователь заблокирован")`.
7. Генерируем JWT-токен (см. п. 4.2).
8. Возвращаем `{ "name": user.name, "access_token": token }`.

### 4.2. JWT

Файл: `backend/src/core/jwt.py` (уже существует, доработать при необходимости)

- Алгоритм: HS256
- Срок действия: 6 часов
- Claims:
  - `sub` — `user.id` (строка UUID)
  - `login` — `user.login`
  - `name` — `user.name`
  - `exp` — время истечения

### 4.3. Зависимость для защиты эндпоинтов

Файл: `backend/src/core/auth.py` (уже существует, доработать)

Создать функцию `get_current_user`:
1. Извлекает заголовок `Authorization: Bearer <token>`.
2. Верифицирует JWT.
3. Загружает пользователя из БД по `sub`.
4. Проверяет `active`.
5. Возвращает объект `User`.
6. Если ошибка — `HTTPException(401)`.

Использовать как `Depends(get_current_user)` в защищённых эндпоинтах.

### 4.4. Создание первого пользователя

Первый пользователь создаётся вручную через БД или отдельным скриптом.

Параметры: name, login, password (на входе — пароль, в БД — SHA-256 хеш).

## 5. Frontend

### 5.1. Страница логина

Файл: `frontend/src/pages/LoginPage.tsx` (уже существует, доработать)

- Отображается, если пользователь не авторизован.
- Поля: логин, пароль, кнопка "Войти".
- Валидация: логин от 3 символов, пароль от 6 символов.
- При нажатии "Войти":
  1. Вычислить SHA-256 от пароля (см. `frontend/src/lib/sha256.ts`).
  2. Вызвать `POST /api/auth/login` с `{ login, hash }`.
  3. При ошибке — показать текст ошибки.
  4. При успехе — сохранить `access_token` и `name` (в localStorage или sessionStorage).
  5. Перенаправить на главный рабочий экран.

### 5.2. Хранение токена

Файл: `frontend/src/lib/auth.ts` (уже существует, доработать)

- `setToken(token: string)` — сохранить токен
- `getToken(): string | null` — получить токен
- `removeToken()` — удалить токен
- `isAuthenticated(): boolean` — проверить наличие токена

### 5.3. API-клиент

Файл: `frontend/src/lib/api.ts` (уже существует, доработать)

- Базовый URL из переменной окружения `VITE_API_URL`.
- Автоматически добавлять заголовок `Authorization: Bearer <token>` для всех запросов, если токен есть.
- При ответе 401 — очищать токен и перенаправлять на страницу логина.

### 5.4. Защита маршрутов

Файл: `frontend/src/components/ProtectedRoute.tsx` (уже существует, доработать)

- Компонент-обёртка: если `isAuthenticated()` — рендерит children, иначе — редирект на `/login`.

### 5.5. Статичный текст на странице логина

На странице логина отобразить краткое описание системы (текст из текущей реализации).

## 6. Критерии готовности

- [ ] Модель User создана, миграция применена.
- [ ] Эндпоинт `POST /api/auth/login` работает.
- [ ] JWT-токен генерируется и верифицируется.
- [ ] Зависимость `get_current_user` работает.
- [ ] Страница логина отображается, вход выполняется.
- [ ] Защищённые маршруты перенаправляют на логин.
- [ ] При 401 на любом запросе — очистка токена и редирект.
