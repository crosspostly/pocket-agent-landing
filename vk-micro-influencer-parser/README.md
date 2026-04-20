# VK Micro-Influencer Parser

Парсер для поиска микроблогеров ВКонтакте по заданным параметрам.

## 🚀 Возможности

- **Поиск по параметрам:**
  - Город (по названию или ID)
  - Возраст (от/до)
  - Аудитория: друзья + подписчики (от/до)
  
- **Фильтры качества:**
  - Реальное имя (без пробелов)
  - Есть фото профиля
  - Больше 3 фотографий
  - Был онлайн менее 30 дней назад
  - Не пустой аккаунт (>10 подписчиков)

- **Автоматический сбор данных:**
  - followers_count (подписчики)
  - friends_count (друзья) — отдельным запросом
  - total_audience = друзья + подписчики
  - last_seen (последняя активность)
  - photo_count (количество фото)

- **Удобный UI:**
  - 🔍 Вкладка поиска — создание задач
  - 📊 Вкладка результатов — просмотр профилей
  - 💬 Вкладка сообщений — генератор текстов
  - ⚙️ Вкладка настроек — токен и статистика

- **Защита от Flood Control:**
  - Экспоненциальная задержка при лимитах VK API
  - 5 попыток с нарастающей паузой (5с → 10с → 20с → 40с → 80с)
  - Максимум 2 минуты между попытками

---

## 📋 Требования

- Node.js 16+
- VK Access Token с правами: `users`

---

## ⚙️ Установка

```bash
# Клонировать репозиторий
cd vk-micro-influencer-parser

# Установить зависимости
npm install

# Настроить .env
cp .env.example .env
# Отредактировать .env и добавить VK_ACCESS_TOKEN
```

### Получение VK Token

1. Перейти на https://oauth.vk.com/authorize?client_id=5155781&display=page&response_type=token&scope=65535&v=5.199
2. Авторизоваться и разрешить доступ
3. Скопировать токен из URL (параметр `access_token`)
4. Вставить в `.env`:
   ```
   VK_ACCESS_TOKEN=vk1.a.xxxxxxxxxxxxx
   ```

---

## 🎯 Запуск

```bash
# Frontend (Vite) + Backend (Express)
npm run dev        # Frontend на http://localhost:5173
npm run server:dev # Backend на http://localhost:3001
```

---

## 📖 Как работает

### Алгоритм поиска

1. **Один запрос к VK API** `users.search` с параметрами:
   - `city` — ID города (или `hometown` — название)
   - `age_from`, `age_to` — диапазон возраста
   - `count=100`, `offset` — пагинация до 1000 результатов
   - `fields=followers_count,photo_200,photo_count,last_seen,...`

2. **Первичная фильтрация** (каждый профиль):
   - ✅ Реальное имя (без пробелов)
   - ✅ Есть фото (photo_200)
   - ✅ > 3 фотографий (photo_count)
   - ✅ Онлайн < 30 дней (last_seen.time)
   - ✅ > 10 подписчиков

3. **Дополнительный запрос** `users.get` для получения `friends_count`:
   - Батчами по 1000 пользователей
   - Через `execute` (один запрос на батч)

4. **Суммирование и финальная фильтрация:**
   - `total_audience = followers_count + friends_count`
   - Фильтр по диапазону аудитории

5. **Сохранение в SQLite:**
   - Таблица `cached_users`
   - Индексы для быстрого поиска

---

### Структура базы данных

```sql
CREATE TABLE cached_users (
  id INTEGER PRIMARY KEY,
  task_id INTEGER,
  vk_id INTEGER UNIQUE,
  first_name TEXT,
  last_name TEXT,
  screen_name TEXT,
  followers_count INTEGER DEFAULT 0,
  friends_count INTEGER DEFAULT 0,      -- друзья
  total_audience INTEGER DEFAULT 0,     -- друзья + подписчики
  city TEXT,
  country TEXT,
  age INTEGER,
  sex INTEGER,
  about TEXT,
  activities TEXT,
  interests TEXT,
  photo_url TEXT,
  profile_url TEXT,
  created_at DATETIME
);
```

---

## 🌐 API

### POST `/api/tasks`
Создать задачу поиска
```json
{
  "cityName": "Москва",
  "minAge": 23,
  "maxAge": 35,
  "minFollowers": 1000,
  "maxFollowers": 10000
}
```

### POST `/api/tasks/:taskId/start`
Запустить парсинг
```json
{
  "accessToken": "vk1.a.xxx"
}
```

### GET `/api/tasks/:taskId/results`
Получить результаты задачи

### POST `/api/token/validate`
Проверить токен
```json
{
  "token": "vk1.a.xxx"
}
```

---

## 🧪 Тестовые скрипты

| Скрипт | Описание |
|--------|----------|
| `test-mock.js` | **Mock-тесты** — тестируют логику без VK API (12 тестов) |
| `test-final.js` | **Интеграционный тест** — полный цикл с реальным API |
| `check-token.js` | Проверка токена напрямую через VK API |
| `check-server.js` | Проверка API сервера |
| `check-create-task.js` | Создание задачи |
| `test-filters.js` | Анализ фильтров (сколько отсеивается) |

Запуск:
```bash
# Mock-тесты (без VK API)
node test-mock.js

# Интеграционный тест (с VK API)
node test-final.js
```

---

## 📊 Статистика и прогресс

Во время парсинга отображается:
- Текущая стратегия
- Найдено пользователей
- Прогресс бар
- Примерное время завершения

---

## 🛡️ Flood Control

VK API ограничивает количество запросов. Реализована система защиты:

```
Попытка 1: задержка 5 секунд
Попытка 2: задержка 10 секунд
Попытка 3: задержка 20 секунд
Попытка 4: задержка 40 секунд
Попытка 5: задержка 80 секунд
Максимум: 120 секунд
```

**Важно:** После множественных запросов VK блокирует на 2-5 минут. Если получаете ошибку `Flood control` — просто подождите.

---

## ✅ Статус

- ✅ Токен валиден
- ✅ Сервер работает (http://localhost:3001)
- ✅ Frontend доступен (http://localhost:5173)
- ✅ БД создана и мигрирована
- ✅ Fallback система реализована
- ✅ UI с вкладками
- ✅ Суммирование друзья + подписчики

---

## 🧪 Быстрый тест

```bash
node test-final.js
```

Проверяет: токен, API, создание задачи, парсинг, результаты.

---

## 📁 Структура проекта

```
vk-micro-influencer-parser/
├── server/
│   ├── index.ts           # Express сервер
│   ├── vkApi.ts           # VK API клиент
│   ├── vkExecute.ts       # Execute метод + fallback
│   ├── database.ts        # SQLite база
│   └── types.ts           # Типы данных
├── src/
│   ├── main.ts            # Frontend логика
│   ├── api.ts             # API запросы
│   └── style.css          # Стили + вкладки
├── data/
│   └── influencers.db     # SQLite база
├── .env                   # Конфигурация
└── package.json
```

---

## 🔧 Конфигурация

### Переменные окружения (.env)

| Переменная | Описание | Пример |
|------------|----------|--------|
| `VK_ACCESS_TOKEN` | Токен VK API | `vk1.a.xxxxx` |
| `PORT` | Порт сервера (опционально) | `3001` |

---

## 📝 Лицензия

MIT

---

## 🆘 Troubleshooting

### Ошибка: `Flood control: too many requests`
- Подождите 2-3 минуты
- Fallback система автоматически сделает паузу

### Ошибка: `User authorization failed: invalid access_token`
- Токен истёк или отозван
- Получите новый: https://oauth.vk.com/authorize?client_id=5155781&display=page&response_type=token&scope=65535&v=5.199

### Найдено 0 пользователей
- Проверьте фильтры (возраст, город, аудитория)
- Flood control — подождите
- Токен не имеет прав `users`

### Медленный парсинг
- Нормально: 1000 профилей ≈ 1-2 минуты
- VK API лимиты: 3 запроса в секунду
- Дополнительно: запрос friends_count для каждого

---

## 📈 Планы

- [ ] Экспорт в CSV/Excel
- [ ] Пакетная отправка сообщений
- [ ] Анализ интересов (ML)
- [ ] Поиск по нескольким городам сразу
- [ ] Расписание задач (cron)
