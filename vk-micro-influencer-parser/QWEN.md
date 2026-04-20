# vk-micro-influencer-parser

## Обзор проекта

**vk-micro-influencer-parser** — это полнофункциональное веб-приложение для поиска и анализа микроблогеров ВКонтакте для бартерного сотрудничества. Приложение состоит из TypeScript-фронтенда (Vite) и Node.js-бэкенда (Express) с SQLite базой данных.

### Основные возможности

- **Парсинг пользователей VK** через API с использованием метода `execute` для оптимизации запросов (до 25 запросов в одном вызове)
- **Мультистратегический поиск** — обход лимита в 1000 результатов через разбиение по возрастным диапазонам и статусу онлайн
- **Анализ интересов** — автоматическая категоризация пользователей по 12 категориям (красота, мода, фитнес, путешествия и др.)
- **Генерация сообщений** — шаблоны для бартерных предложений с рандомизацией синонимов и эмодзи
- **Сохранение результатов** в SQLite базу данных с возможностью повторного использования
- **Экспорт результатов** в CSV формат
- **Веб-интерфейс** с прогресс-барами, статистикой и предпросмотром

### Архитектура

```
vk-micro-influencer-parser/
├── src/                    # Фронтенд (Vite + TypeScript)
│   ├── main.ts            # Точка входа, UI-класс InfluencerParserApp
│   ├── api.ts             # API-клиент для общения с бэкендом
│   ├── csvExport.ts       # Экспорт результатов в CSV
│   └── style.css          # Стили (CSS-градиенты, карточки)
├── server/                 # Бэкенд (Express + TypeScript)
│   ├── index.ts           # Express сервер, REST API endpoints
│   ├── database.ts        # SQLite менеджер базы данных
│   ├── vkApi.ts           # VK API клиент (searchUsers, getUserFollowers)
│   ├── vkService.ts       # Сервис парсинга с управлением прогрессом
│   ├── vkExecute.ts       # Оптимизированный клиент с execute-батчами
│   ├── interestAnalyzer.ts # Анализ интересов пользователей
│   ├── messageTemplates.ts # Шаблоны сообщений и рандомизация
│   └── types.ts           # Общие типы (VKUser, SearchFilters)
├── data/
│   └── influencers.db     # SQLite база данных
├── dist/                   # Сбилженный фронтенд
└── public/                 # Статические файлы
```

## Технологии

| Компонент | Технология |
|-----------|------------|
| Фронтенд | TypeScript, Vite 7.x, Vanilla JS |
| Бэкенд | Node.js, Express 5.x, ts-node |
| База данных | SQLite3, sqlite |
| VK API | axios, метод execute для батч-запросов |
| Утилиты | dotenv, cors, node-cron, papaparse |

## Установка и запуск

### Предварительные требования

- Node.js 18+
- VK Access Token (получить на https://vk.com/dev)

### Установка зависимостей

```bash
npm install
```

### Настройка

1. Скопируйте `.env.example` в `.env`:
```bash
cp .env.example .env
```

2. Добавьте VK Access Token в `.env`:
```
VK_ACCESS_TOKEN=ваш_токен_здесь
PORT=3001
```

### Команды

| Команда | Описание |
|---------|----------|
| `npm run dev` | Запуск фронтенда на Vite (localhost:5173) |
| `npm run server` | Запуск бэкенда (ts-node) |
| `npm run server:dev` | Запуск бэкенда с nodemon (auto-reload) |
| `npm run build` | Сборка фронтенда (tsc + vite build) |
| `npm run preview` | Предпросмотр сбилженного фронтенда |
| `npm start` | Сборка + запуск сервера (продакшен режим) |

### Полный запуск приложения

```bash
# Терминал 1 - бэкенд
npm run server:dev

# Терминал 2 - фронтенд (опционально, т.к. сервер раздаёт статику из dist/)
npm run dev
```

Или в продакшен режиме:
```bash
npm start
```

После запуска откройте http://localhost:3001

## REST API

### Задачи парсинга

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/tasks` | Получить все задачи |
| POST | `/api/tasks` | Создать задачу (body: cityId, minAge, minFollowers, maxFollowers) |
| GET | `/api/tasks/:taskId` | Получить статус задачи |
| POST | `/api/tasks/:taskId/start` | Запустить парсинг (body: accessToken) |
| GET | `/api/tasks/:taskId/results` | Получить результаты задачи |
| DELETE | `/api/tasks/:taskId` | Удалить задачу |

### Пользователи

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/users` | Поиск пользователей (query: city, minFollowers, maxFollowers, minAge) |
| POST | `/api/users/:taskId/analyze` | Анализ интересов (body: categories, keywords, minConfidence) |
| POST | `/api/users/search` | Поиск по ключевым словам |

### Токен и шаблоны

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| POST | `/api/token` | Сохранить токен в .env |
| GET | `/api/token` | Проверить наличие сохранённого токена |
| POST | `/api/token/validate` | Валидировать токен |
| POST | `/api/preview` | Предпросмотр оценки результатов |
| GET | `/api/templates` | Получить шаблоны сообщений |
| POST | `/api/templates/:templateId/generate` | Сгенерировать сообщение |

### Статистика

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/stats` | Общая статистика (users, tasks, cities) |
| GET | `/api/interests/categories` | Список категорий интересов |

## Структура базы данных

### Таблица `search_tasks`

| Поле | Тип | Описание |
|------|-----|----------|
| id | INTEGER | Первичный ключ |
| city_id | INTEGER | ID города VK |
| city_name | TEXT | Название города |
| min_age | INTEGER | Минимальный возраст |
| min_followers | INTEGER | Мин. количество подписчиков |
| max_followers | INTEGER | Макс. количество подписчиков |
| status | TEXT | pending/processing/completed/failed |
| created_at | DATETIME | Дата создания |
| completed_at | DATETIME | Дата завершения |
| total_found | INTEGER | Найдено пользователей |

### Таблица `cached_users`

| Поле | Тип | Описание |
|------|-----|----------|
| id | INTEGER | Первичный ключ |
| task_id | INTEGER | Внешний ключ на search_tasks |
| vk_id | INTEGER | Уникальный ID пользователя VK |
| first_name, last_name | TEXT | Имя и фамилия |
| screen_name | TEXT | Короткое имя профиля |
| followers_count | INTEGER | Количество подписчиков |
| city, country | TEXT | Город и страна |
| age, sex | INTEGER | Возраст и пол |
| about, activities, interests | TEXT | Информация о пользователе |
| photo_url, profile_url | TEXT | Ссылки на фото и профиль |

## Ключевые компоненты

### VKExecuteClient (`server/vkExecute.ts`)

Оптимизированный клиент для VK API, использующий метод `execute` для батч-запросов:

- **executeBatch** — выполнение до 25 методов API в одном запросе
- **getUsersBatch** — получение информации о до 1000 пользователях
- **searchUsersBatch** — поиск с пагинацией через execute

### optimizedUserSearch

Функция мультистратегического поиска:

1. Разбивает возрастные диапазоны на интервалы по 2-3 года
2. Добавляет стратегии по статусу онлайн (online_young, online_adult, online_mature)
3. Использует Map для хранения уникальных пользователей
4. Фильтрует по городу, подписчикам и возрасту
5. Отслеживает прогресс через callback

### MessageRandomizer (`server/messageTemplates.ts`)

Генератор сообщений для бартерных предложений:

- **randomize** — замена переменных, рандомизация синонимов и эмодзи
- **generateAIVariant** — генерация вариантов с разным тоном (friendly/professional/casual)
- **generateVariants** — создание нескольких вариантов сообщения

### analyzeUserInterests (`server/interestAnalyzer.ts`)

Анализ интересов пользователя:

- 12 категорий интересов с весовыми коэффициентами
- Подсчёт совпадений ключевых слов в полях activities, interests, about, status
- Расчёт уверенности (confidence score)
- Ранжирование для бартерного сотрудничества

## Практики разработки

### Код-стайл

- **TypeScript strict mode** — включены все строгие проверки
- **No unused locals/parameters** — запрет неиспользуемых переменных
- **ES2022** — современный синтаксис TypeScript
- **Именование** — camelCase для переменных, PascalCase для классов/интерфейсов

### Тестирование

В проекте нет настроенного тестового фреймворка. Рекомендуется добавить:
- Unit-тесты для `interestAnalyzer.ts` и `messageTemplates.ts`
- Интеграционные тесты для API endpoints

### Безопасность

- Токен сохраняется в `.env` файле (не в коде)
- API endpoint `/api/token/validate` не возвращает сам токен
- Для отправки сообщений требуется отдельное разрешение `messages` scope

## Известные ограничения

1. **Лимит VK API** — 1000 результатов на один поисковый запрос (обходится через мультистратегии)
2. **Отправка сообщений** — требует User Token с scope `messages` и разрешения от пользователя
3. **Парсинг** — может занять 5-30 минут в зависимости от города и фильтров
4. **База данных** — SQLite, не предназначена для высокой конкуренции

## Расширение функционала

### Добавить новую категорию интересов

В `server/interestAnalyzer.ts`:

```typescript
export const INTEREST_CATEGORIES = {
  // ...
  new_category: {
    keywords: ['ключевое', 'слово'],
    weight: 1.3
  }
};
```

### Добавить шаблон сообщения

В `server/messageTemplates.ts`:

```typescript
{
  id: 'custom_1',
  name: 'Custom Template',
  subject: 'Тема письма',
  body: 'Текст с переменными {first_name}, {sender_name}',
  variables: ['first_name', 'sender_name']
}
```

### Добавить город для поиска

В `server/vkExecute.ts`:

```typescript
const CITY_IDS: Record<number, { id: number; name: string }> = {
  98: { id: 98, name: 'Нижний Новгород' },
  // Новый город:
  2: { id: 2, name: 'Санкт-Петербург' },
};
```

## Получение VK Access Token

1. Перейдите на https://vk.com/dev
2. Создайте Standalone-приложение
3. Получите токен с правами: `users`, `photos` (для парсинга), `messages` (для отправки)
4. Используйте формат: `vk1.a.<token>`

## Экспорт данных

Приложение поддерживает экспорт результатов в CSV через `src/csvExport.ts`. Формат:

```csv
vk_id,first_name,last_name,screen_name,followers_count,city,age,profile_url
123456,Иван,Иванов,ivanov,1500,Москва,25,https://vk.com/ivanov
```
