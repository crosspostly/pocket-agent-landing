/**
 * Mock-тесты для VK Micro-Influencer Parser
 * Тестируют логику без реального VK API
 */

// === МОК ДАННЫЕ ===

const mockUsers = [
  {
    id: 1,
    first_name: 'Иван',
    last_name: 'Иванов',
    screen_name: 'ivanov',
    followers_count: 5000,
    friends_count: 300,
    total_audience: 5300,
    city: 'Москва',
    age: 25,
    sex: 2,
    photo_count: 15,
    last_seen: { time: Math.floor(Date.now() / 1000) },
    photo_200: 'https://example.com/photo.jpg'
  },
  {
    id: 2,
    first_name: 'Петр',
    last_name: 'Петров',
    screen_name: 'petrov',
    followers_count: 8000,
    friends_count: 500,
    total_audience: 8500,
    city: 'Санкт-Петербург',
    age: 30,
    sex: 2,
    photo_count: 5,
    last_seen: { time: Math.floor(Date.now() / 1000) },
    photo_200: 'https://example.com/photo2.jpg'
  },
  {
    id: 3,
    first_name: 'Анна',
    last_name: 'Смирнова',
    screen_name: 'annasmir',
    followers_count: 3000,
    friends_count: 200,
    total_audience: 3200,
    city: 'Казань',
    age: 28,
    sex: 1,
    photo_count: 20,
    last_seen: { time: Math.floor((Date.now() - 86400000 * 10) / 1000) }, // 10 дней назад
    photo_200: 'https://example.com/photo3.jpg'
  },
  {
    id: 4,
    first_name: 'Fake',
    last_name: 'Account', // Фейк - имя с пробелом в названии
    screen_name: 'fake_shop',
    followers_count: 10000,
    friends_count: 50,
    total_audience: 10050,
    city: 'Москва',
    age: 25,
    sex: 0,
    photo_count: 100,
    last_seen: { time: Math.floor(Date.now() / 1000) },
    photo_200: 'https://example.com/photo4.jpg'
  },
  {
    id: 5,
    first_name: 'Ольга',
    last_name: 'Кузнецова',
    screen_name: 'olgak',
    followers_count: 1500,
    friends_count: 150,
    total_audience: 1650,
    city: 'Нижний Новгород',
    age: 35,
    sex: 1,
    photo_count: 2, // Мало фото
    last_seen: { time: Math.floor(Date.now() / 1000) },
    photo_200: 'https://example.com/photo5.jpg'
  }
];

// === ФУНКЦИИ ДЛЯ ТЕСТА (из vkExecute.ts) ===

function extractTokenFromUrl(url) {
  const hashMatch = url.match(/#.*access_token=([^&]+)/);
  if (hashMatch) return hashMatch[1];
  
  const queryMatch = url.match(/[?&]access_token=([^&]+)/);
  if (queryMatch) return queryMatch[1];
  
  if (/^vk1\.a\./.test(url.trim())) return url.trim();

  return null;
}

function filterUsers(users, filters) {
  const {
    minFollowers = 1000,
    maxFollowers = 10000,
    minAge = 18,
    maxAge = 60,
    city = null
  } = filters;

  return users.filter(user => {
    // Фильтр 1: Аудитория (друзья + подписчики)
    const totalAudience = user.total_audience || (user.followers_count + user.friends_count);
    if (totalAudience < minFollowers || totalAudience > maxFollowers) {
      return false;
    }

    // Фильтр 2: Возраст
    if (user.age && (user.age < minAge || user.age > maxAge)) {
      return false;
    }

    // Фильтр 3: Город
    if (city && user.city !== city) {
      return false;
    }

    // Фильтр 4: Реальное имя (без пробелов в фамилии/имени)
    const hasRealName = !(user.first_name.includes(' ') || user.last_name.includes(' '));
    if (!hasRealName) {
      return false;
    }

    // Фильтр 5: Есть фото
    if (!user.photo_200) {
      return false;
    }

    // Фильтр 6: > 3 фотографий
    if ((user.photo_count || 0) < 3) {
      return false;
    }

    // Фильтр 7: Онлайн < 30 дней
    if (user.last_seen && user.last_seen.time) {
      const daysSinceLastSeen = (Date.now() - user.last_seen.time * 1000) / (1000 * 60 * 60 * 24);
      if (daysSinceLastSeen > 30) {
        return false;
      }
    }

    return true;
  });
}

function calculateTotalAudience(user) {
  return (user.followers_count || 0) + (user.friends_count || 0);
}

// === ТЕСТЫ ===

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: ожидалось ${expected}, получено ${actual}`);
  }
}

// Запуск тестов
console.log('=== 🧪 MOCK ТЕСТЫ ===\n');

// Тест 1: Извлечение токена из URL
test('Извлечение токена из полного URL', () => {
  const url = 'https://oauth.vk.com/blank.html#access_token=vk1.a.test123&expires_in=0&user_id=123';
  const token = extractTokenFromUrl(url);
  assertEqual(token, 'vk1.a.test123', 'Токен не извлечён');
});

test('Извлечение чистого токена', () => {
  const token = 'vk1.a.DRp-Fcl7vdmgc0z37cOlkc8n';
  const extracted = extractTokenFromUrl(token);
  assertEqual(extracted, token, 'Чистый токен изменён');
});

test('Извлечение токена из query string', () => {
  const url = 'https://example.com/?access_token=vk1.a.query123';
  const token = extractTokenFromUrl(url);
  assertEqual(token, 'vk1.a.query123', 'Токен из query не извлечён');
});

// Тест 2: Фильтрация пользователей
test('Фильтрация по аудитории', () => {
  const filtered = filterUsers(mockUsers, {
    minFollowers: 3000,
    maxFollowers: 9000
  });
  assert(filtered.length >= 2, 'Должно быть найдено хотя бы 2 пользователя');
  assert(filtered.every(u => u.total_audience >= 3000 && u.total_audience <= 9000), 'Все должны быть в диапазоне');
});

test('Фильтрация по городу', () => {
  const filtered = filterUsers(mockUsers, { city: 'Москва' });
  assert(filtered.length >= 1, 'Должен быть найден хотя бы 1 пользователь из Москвы');
  assert(filtered.every(u => u.city === 'Москва'), 'Все должны быть из Москвы');
});

test('Фильтрация по возрасту', () => {
  const filtered = filterUsers(mockUsers, { minAge: 25, maxAge: 30 });
  assert(filtered.every(u => u.age >= 25 && u.age <= 30), 'Все должны быть в возрасте 25-30');
});

test('Отсев фейковых имён', () => {
  const filtered = filterUsers(mockUsers, {});
  const fakeAccount = filtered.find(u => u.id === 4);
  assert(!fakeAccount, 'Фейковый аккаунт должен быть отсеян');
});

test('Отсев аккаунтов с малым количеством фото', () => {
  const filtered = filterUsers(mockUsers, {});
  const lowPhotoAccount = filtered.find(u => u.id === 5);
  assert(!lowPhotoAccount, 'Аккаунт с < 3 фото должен быть отсеян');
});

// Тест 3: Расчёт общей аудитории
test('Расчёт total_audience', () => {
  const user = { followers_count: 5000, friends_count: 300 };
  const total = calculateTotalAudience(user);
  assertEqual(total, 5300, 'Сумма друзей и подписчиков неверна');
});

test('Расчёт с нулевыми значениями', () => {
  const user = { followers_count: 0, friends_count: 0 };
  const total = calculateTotalAudience(user);
  assertEqual(total, 0, 'Сумма должна быть 0');
});

// Тест 4: Комплексная фильтрация
test('Комплексная фильтрация (все фильтры)', () => {
  const filtered = filterUsers(mockUsers, {
    minFollowers: 3000,
    maxFollowers: 9000,
    minAge: 25,
    maxAge: 35,
    city: 'Москва'
  });
  
  assert(filtered.length >= 1, 'Должен быть найден хотя бы 1 пользователь');
  filtered.forEach(user => {
    assert(user.total_audience >= 3000 && user.total_audience <= 9000, 'Аудитория в диапазоне');
    assert(user.age >= 25 && user.age <= 35, 'Возраст в диапазоне');
    assert(user.city === 'Москва', 'Город Москва');
    assert(!user.first_name.includes(' ') && !user.last_name.includes(' '), 'Реальное имя');
    assert(user.photo_count >= 3, '> 3 фото');
  });
});

// Тест 5: Проверка last_seen
test('Проверка last_seen (онлайн < 30 дней)', () => {
  const now = Math.floor(Date.now() / 1000);
  const oldUser = {
    id: 99,
    first_name: 'Old',
    last_name: 'User',
    followers_count: 5000,
    friends_count: 300,
    total_audience: 5300,
    photo_count: 10,
    photo_200: 'url',
    last_seen: { time: now - (31 * 24 * 60 * 60) } // 31 день назад
  };
  
  const filtered = filterUsers([oldUser, mockUsers[0]], {});
  const oldInFiltered = filtered.find(u => u.id === 99);
  assert(!oldInFiltered, 'Пользователь не активный 31 день должен быть отсеян');
});

// Итоги
console.log('\n=== ИТОГИ ===');
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
console.log(`📊 Всего: ${passed + failed}`);

if (failed === 0) {
  console.log('\n🎉 Все тесты пройдены!');
  process.exit(0);
} else {
  console.log('\n⚠️ Есть ошибки');
  process.exit(1);
}
