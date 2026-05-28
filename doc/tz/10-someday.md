# ТЗ-10: КНМБ (Когда-нибудь, может быть)

## 1. Цель модуля

Реализовать список "Когда-нибудь, может быть" (Someday/Maybe) — хранилище для задач, целей, желаний, которые не находятся в активной фазе работы, но могут быть взяты в работу в будущем. Освобождает голову пользователя от необходимости помнить о них.

## 2. Зависимости

- Модуль **01 — Авторизация** (защита эндпоинтов).
- Модуль **02 — Сферы жизни** (фильтрация по сферам).
- Модуль **04 — Проекты и задачи** (проекты могут быть перемещены в КНМБ).

## 3. Концепция

КНМБ — это отдельный список, куда попадают:
- Проекты/задачи, которые пользователь решил отложить (статус проекта меняется на "someday").
- Идеи и хотелки, которые пользователь записывает сразу в КНМБ (не создавая проект).

Раз в некоторое время (например, раз в квартал) пользователь просматривает КНМБ и решает: взять в работу, удалить навсегда или оставить.

## 4. Модель данных

### 4.1. Вариант А: Поле статуса в Project

Добавить в модель `Project` новый статус `SOMEDAY = "someday"` в `ProjectStatus`.

Проекты со статусом "someday" не отображаются в списке активных проектов, но отображаются в КНМБ.

### 4.2. Вариант Б: Отдельная сущность SomedayItem

Если нужно хранить в КНМБ не только проекты, но и произвольные заметки/идеи:

```python
class SomedayItem(BaseModel, table=True):
    __tablename__ = "someday_items"

    user_id: UUID = Field(foreign_key="users.id", nullable=False, index=True)
    sphere_id: UUID | None = Field(foreign_key="spheres.id", default=None, index=True)
    project_id: UUID | None = Field(foreign_key="projects.id", default=None)  # если перенесён из проектов
    title: str = Field(nullable=False, max_length=300)
    description: str | None = Field(default=None, max_length=2000)
    days_in_someday: int = Field(nullable=False, default=0)  # сколько дней уже здесь
```

**Рекомендуется Вариант Б**, так как он гибче и позволяет хранить произвольные записи.

### 4.3. Миграция

Поля `someday_items`:
- `id` — `sa.Uuid()`, PK
- `user_id` — `sa.Uuid()`, FK → users.id, not null, index
- `sphere_id` — `sa.Uuid()`, FK → spheres.id, nullable, index
- `project_id` — `sa.Uuid()`, FK → projects.id, nullable
- `title` — `sa.String(300)`, not null
- `description` — `sa.String(2000)`, nullable
- `days_in_someday` — `sa.Integer()`, not null, default 0
- `created_at`, `updated_at` — стандартные

### 4.4. Схемы Pydantic

```python
class SomedayItemRead(BaseModel):
    id: UUID
    sphere_id: Optional[UUID]
    sphere_code: Optional[str]
    sphere_name: Optional[str]
    project_id: Optional[UUID]
    title: str
    description: Optional[str]
    days_in_someday: int
    created_at: datetime

class SomedayItemCreate(BaseModel):
    sphere_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    title: str = Field(..., max_length=300)
    description: Optional[str] = Field(default=None, max_length=2000)

class SomedayItemUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=300)
    description: Optional[str] = Field(default=None, max_length=2000)
```

## 5. Backend

### 5.1. Эндпоинты

Файл: `backend/src/api/endpoints/someday.py`

Защищены `Depends(get_current_user)`.

#### GET /api/someday

Параметры запроса:
- `sphere_id: UUID | None` — фильтр по сфере

Выход: список `SomedayItemRead`

Логика:
- Выбрать все записи для `user_id`.
- Присоединить `sphere_code`, `sphere_name`.
- Вычислить `days_in_someday` (текущая дата - created_at).
- Отсортировать по `created_at DESC`.

#### POST /api/someday

Вход: `SomedayItemCreate`
Выход: `SomedayItemRead`

Логика:
- Если передан `project_id`, проверить, что проект принадлежит `user_id`.
- Создать запись.
- Если передан `project_id`, изменить статус проекта на "someday".
- Вернуть созданную запись.

#### PUT /api/someday/{item_id}

Вход: `SomedayItemUpdate`
Выход: `SomedayItemRead`

#### DELETE /api/someday/{item_id}

Выход: `204 No Content`

Логика:
- Полное удаление записи (не soft delete, так как это не активная сущность).

#### POST /api/someday/{item_id}/activate

Выход: `ProjectRead` (созданный или восстановленный проект)

Логика:
- Если запись связана с `project_id` — восстановить проект (статус → "active").
- Если не связана — создать новый проект типа "task" с названием из записи.
- Удалить запись из КНМБ.

## 6. Frontend

### 6.1. Страница КНМБ

Путь: `/someday` (доступна только авторизованным)

**Отображение:**
- Фильтр по сферам (компонент `SphereFilter`).
- Список записей:
  - Код сферы
  - Название
  - Описание (если есть)
  - Сколько дней в КНМБ
  - Кнопки: взять в работу, редактировать, удалить

**Действия:**
- Кнопка "Добавить" — модальное окно с полями: сфера, название, описание.
- "Взять в работу" — запись перемещается в активные проекты.
- "Редактировать" — модальное окно.
- "Удалить" — подтверждение, затем полное удаление.

### 6.2. Интеграция с проектами

На странице проекта, если пользователь хочет отложить проект, кнопка "В КНМБ" → проект перемещается в список КНМБ.

## 7. Критерии готовности

- [ ] Модель SomedayItem создана, миграция применена.
- [ ] CRUD эндпоинты для КНМБ работают.
- [ ] Механизм "взять в работу" создаёт/восстанавливает проект.
- [ ] Страница КНМБ отображается.
- [ ] Фильтрация по сферам работает.
- [ ] Интеграция с проектами (перемещение в КНМБ и обратно) работает.
