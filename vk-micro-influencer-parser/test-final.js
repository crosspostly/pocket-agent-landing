#!/usr/bin/env node
/**
 * Финальный тест работы парсера
 * Проверяет: токен, API, создание задачи, парсинг
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const TOKEN = fs.readFileSync(path.join(__dirname, '.env'), 'utf8')
  .match(/VK_ACCESS_TOKEN=(.+)/)[1].trim();

const API_URL = 'http://localhost:3001';

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          resolve({ raw: responseData });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTest() {
  console.log('=== 🧪 ФИНАЛЬНЫЙ ТЕСТ ===\n');

  // 1. Проверка токена
  console.log('1️⃣ Проверка токена...');
  const tokenResult = await request('POST', '/api/token/validate', { token: TOKEN });
  if (tokenResult.valid) {
    console.log(`   ✅ Токен валиден: ${tokenResult.user.first_name} ${tokenResult.user.last_name}`);
  } else {
    console.error(`   ❌ Токен невалиден: ${tokenResult.error}`);
    return;
  }

  // 2. Проверка API
  console.log('\n2️⃣ Проверка API сервера...');
  const apiResult = await request('GET', '/api/token');
  if (apiResult.hasToken) {
    console.log('   ✅ Сервер работает, токен загружен');
  } else {
    console.error('   ❌ Сервер не отвечает');
    return;
  }

  // 3. Создание задачи
  console.log('\n3️⃣ Создание задачи...');
  const taskData = {
    cityName: 'Москва',
    minAge: 25,
    maxAge: 35,
    minFollowers: 500,
    maxFollowers: 50000,
    searchAllCities: false
  };
  const taskResult = await request('POST', '/api/tasks', taskData);
  if (taskResult.taskId) {
    console.log(`   ✅ Задача создана: ID=${taskResult.taskId}`);
  } else {
    console.error(`   ❌ Ошибка: ${taskResult.error || taskResult.details}`);
    return;
  }

  // 4. Запуск парсинга
  console.log('\n4️⃣ Запуск парсинга...');
  const startResult = await request('POST', `/api/tasks/${taskResult.taskId}/start`, { accessToken: TOKEN });
  if (startResult.message === 'Parsing started') {
    console.log('   ✅ Парсинг запущен');
  } else {
    console.error(`   ❌ Ошибка: ${startResult.error}`);
    return;
  }

  // 5. Ожидание и проверка результата
  console.log('\n5️⃣ Ожидание завершения (до 2 минут)...');
  let completed = false;
  for (let i = 0; i < 24; i++) { // 24 * 5 сек = 2 минуты
    await new Promise(r => setTimeout(r, 5000));
    
    const status = await request('GET', '/api/tasks');
    const task = status.find(t => t.id === taskResult.taskId);
    
    if (task && task.status === 'completed') {
      console.log(`   ✅ Задача завершена! Найдено: ${task.total_found} пользователей`);
      completed = true;
      break;
    } else if (task && task.status === 'failed') {
      console.error(`   ❌ Задача провалена: ${task.error_message}`);
      break;
    } else {
      process.stdout.write('.');
    }
  }

  if (!completed) {
    console.log('\n   ⏳ Превышено время ожидания (2 минуты)');
  }

  // 6. Получение результатов
  console.log('\n6️⃣ Получение результатов...');
  const results = await request('GET', `/api/tasks/${taskResult.taskId}/results`);
  if (Array.isArray(results)) {
    console.log(`   ✅ В базе: ${results.length} пользователей`);
    if (results.length > 0) {
      const user = results[0];
      console.log(`\n   Пример профиля:
      - Имя: ${user.first_name} ${user.last_name}
      - Подписчики: ${user.followers_count}
      - Друзья: ${user.friends_count || 0}
      - Всего: ${user.total_audience || user.followers_count}
      - Город: ${user.city || '?'}
      - Профиль: ${user.profile_url}`);
    }
  }

  console.log('\n=== ✅ ТЕСТ ЗАВЕРШЁН ===');
}

runTest().catch(err => {
  console.error('❌ Ошибка теста:', err.message);
  process.exit(1);
});
