# ТЗ-07: Алгоритм выбора действия (Scoring Algorithm)

## 1. Цель модуля

Реализовать алгоритм, который на основе набора параметров вычисляет количественную оценку (Score) для каждого активного действия пользователя и возвращает TOP-1 действие, рекомендуемое для выполнения прямо сейчас.

## 2. Зависимости

- Модуль **01 — Авторизация** (защита эндпоинтов).
- Модуль **05 — Действия** (читаем действия с их параметрами).
- Модуль **02 — Сферы жизни** (оценка удовлетворённости сферы).
- Модуль **04 — Проекты** (признак проактивности, застопоренности).

## 3. Концепция

Алгоритм вычисляет Score для каждого действия по формуле:

```
Score = w1 * f_importance + w2 * f_consequences + w3 * f_urgency + w4 * f_proactive + w5 * f_stuck + w6 * f_sphere_satisfaction + w7 * f_sphere_inactivity - w8 * f_refusals
```

Где:
- `w1...w8` — настраиваемые весовые коэффициенты (по умолчанию все = 1.0)
- `f_importance` — вклад важности действия
- `f_consequences` — вклад последствий невыполнения
- `f_urgency` — вклад срочности (на основе дедлайна)
- `f_proactive` — бонус за проактивное (целевое) действие
- `f_stuck` — бонус за "застопоренный" проект
- `f_sphere_satisfaction` — бонус за низкую удовлетворённость в сфере
- `f_sphere_inactivity` — бонус за давно неактивную сферу
- `f_refusals` — штраф за количество отказов

## 4. Backend

### 4.1. Модель настроек

Файл: `backend/src/models/scoring_settings.py`

```python
from models.base import UserOwnedModel
from sqlmodel import Field

class ScoringSettings(UserOwnedModel, table=True):
    __tablename__ = "scoring_settings"

    # ✅ user_id, id, created_at, updated_at — унаследованы от UserOwnedModel
    # user_id уже уникален благодаря PK, но добавим unique индекс

    w_importance: float = Field(nullable=False, default=1.0)
    w_consequences: float = Field(nullable=False, default=1.0)
    w_urgency: float = Field(nullable=False, default=1.0)
    w_proactive: float = Field(nullable=False, default=1.0)
    w_stuck: float = Field(nullable=False, default=1.0)
    w_sphere_satisfaction: float = Field(nullable=False, default=1.0)
    w_sphere_inactivity: float = Field(nullable=False, default=1.0)
    w_refusals: float = Field(nullable=False, default=1.0)
```

### 4.2. Сервис алгоритма

Файл: `backend/src/services/scoring_service.py`

```python
from uuid import UUID
from datetime import datetime, timezone

class ScoringService:
    def __init__(self, user_id: UUID, settings: ScoringSettings):
        self.user_id = user_id
        self.s = settings

    def calculate_score(self, action: Action, project: Project, sphere: Sphere,
                        last_action_date: datetime | None) -> float:
        score = 0.0

        # 1. Важность (0-3 → 0-1)
        f_importance = action.importance / 3.0
        score += self.s.w_importance * f_importance

        # 2. Последствия (0-3 → 0-1)
        f_consequences = action.consequences / 3.0
        score += self.s.w_consequences * f_consequences

        # 3. Срочность (на основе периода действия)
        f_urgency = self._calc_urgency(action)
        score += self.s.w_urgency * f_urgency

        # 4. Проактивность (есть привязка к цели)
        f_proactive = 1.0 if project.goal_id is not None else 0.0
        score += self.s.w_proactive * f_proactive

        # 5. Застопоренный проект (нет действий > N дней)
        f_stuck = self._calc_stuck(project, last_action_date)
        score += self.s.w_stuck * f_stuck

        # 6. Низкая удовлетворённость сферы
        f_sphere_satisfaction = self._calc_sphere_satisfaction(sphere)
        score += self.s.w_sphere_satisfaction * f_sphere_satisfaction

        # 7. Давно не было действий в сфере
        f_sphere_inactivity = self._calc_sphere_inactivity(sphere, last_action_date)
        score += self.s.w_sphere_inactivity * f_sphere_inactivity

        # 8. Штраф за отказы
        f_refusals = min(action.refusal_count / 10.0, 1.0)  # max штраф = 1.0
        score -= self.s.w_refusals * f_refusals

        return round(score, 4)

    def _calc_urgency(self, action: Action) -> float:
        """Вычисление срочности на основе периода действия."""
        if not action.start_date or not action.end_date:
            return 0.0

        now = datetime.now(timezone.utc)
        total_days = (action.end_date - action.start_date).days
        if total_days <= 0:
            return 1.0  # дедлайн сегодня

        days_passed = (now - action.start_date).days
        progress_ratio = days_passed / total_days

        if progress_ratio < 0.33:
            # Первая треть периода — низкая срочность
            return progress_ratio * 3 * 0.5  # 0 → 0.5
        elif progress_ratio < 0.67:
            # Вторая треть — средняя срочность
            return 0.5 + (progress_ratio - 0.33) * 1.5  # 0.5 → 1.0
        else:
            # Последняя треть — высокая срочность
            return 1.0 + (progress_ratio - 0.67) * 3.0  # 1.0 → 2.0

    def _calc_stuck(self, project: Project, last_action_date: datetime | None) -> float:
        """Проект застопорился, если давно не было действий."""
        if last_action_date is None:
            return 1.0  # нет действий вообще

        now = datetime.now(timezone.utc)
        days_since_last_action = (now - last_action_date).days

        if days_since_last_action < 3:
            return 0.0
        elif days_since_last_action < 7:
            return 0.5
        elif days_since_last_action < 14:
            return 0.8
        else:
            return 1.0

    def _calc_sphere_satisfaction(self, sphere: Sphere) -> float:
        """Чем ниже satisfaction, тем выше бонус."""
        return max(0.0, (5.0 - sphere.satisfaction) / 5.0)

    def _calc_sphere_inactivity(self, sphere: Sphere, last_action_date: datetime | None) -> float:
        """Давно не было действий в сфере."""
        if last_action_date is None:
            return 1.0

        now = datetime.now(timezone.utc)
        days_since = (now - last_action_date).days

        if days_since < 3:
            return 0.0
        elif days_since < 7:
            return 0.3
        elif days_since < 14:
            return 0.6
        elif days_since < 30:
            return 0.8
        else:
            return 1.0
```

### 4.3. Эндпоинты

Файл: `backend/src/api/endpoints/scoring.py`

Все эндпоинты защищены `Depends(get_current_user)`.

#### GET /api/scoring/next

Выход: `ActionRead | null`

Логика:
1. Получить все активные действия пользователя.
2. Отфильтровать:
   - Статус = "active"
   - Входит в диапазон дат (start_date <= now <= end_date)
   - Не пересекается с жёсткими встречами (is_time_bound = True)
3. Для каждого действия вычислить Score через `ScoringService`.
4. Отсортировать по Score DESC.
5. Вернуть TOP-1.
6. Если действий нет — вернуть `null`.

#### GET /api/scoring/list

Выход: список `{ action: ActionRead, score: float }` (все действия с оценками, отсортированные)

#### GET /api/scoring/settings

Выход: `ScoringSettings` (текущие настройки весов)

#### PUT /api/scoring/settings

Вход: частичное обновление `ScoringSettings`
Выход: `ScoringSettings`

### 4.4. Фильтрация встреч

Действия с `is_time_bound = True` не должны предлагаться алгоритмом. Они отображаются только в календаре. Однако если текущее время попадает в интервал встречи (с учётом travel_time), это действие блокирует показ других действий.

## 5. Frontend

### 5.1. Страница настроек алгоритма

Путь: `/settings/scoring` (доступна только авторизованным)

**Отображение:**
- Список весовых коэффициентов с ползунками (0.0 — 5.0, шаг 0.1):
  - Важность
  - Последствия
  - Срочность
  - Проактивность
  - Застопоренность
  - Удовлетворённость сферы
  - Неактивность сферы
  - Штраф за отказы
- Кнопка "Сбросить на умолчания"

### 5.2. Отображение Score в списке действий

На странице действий проекта можно добавить колонку "Score" (если включён режим отладки), чтобы пользователь видел, как алгоритм оценивает действия.

## 6. Критерии готовности

- [ ] Сервис ScoringService реализован.
- [ ] Эндпоинт `/api/scoring/next` возвращает корректное TOP-1 действие.
- [ ] Фильтрация встреч работает.
- [ ] Настройки весов сохраняются и применяются.
- [ ] Страница настроек алгоритма отображается.
