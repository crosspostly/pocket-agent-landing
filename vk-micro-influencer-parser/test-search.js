const http = require('http');
const fs = require('fs');
const path = require('path');

// Читаем токен
const envPath = path.join(__dirname, '.env');
const token = fs.readFileSync(envPath, 'utf8').match(/VK_ACCESS_TOKEN=(.+)/)[1].trim();

console.log('=== ТЕСТОВЫЙ ЗАПУСК ===');
console.log('Параметры: Москва, возраст 20-40, подписчики 500-50000\n');

// Создаём задачу
const createData = {
  cityName: 'Москва',
  minAge: 20,
  maxAge: 40,
  minFollowers: 500,
  maxFollowers: 50000,
  searchAllCities: false
};

const createPostData = JSON.stringify(createData);

const createOptions = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/tasks',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(createPostData)
  }
};

const createReq = http.request(createOptions, (res) => {
  let responseData = '';
  res.on('data', (chunk) => responseData += chunk);
  res.on('end', () => {
    const result = JSON.parse(responseData);
    console.log('✅ Задача создана:', result.taskId);
    console.log('⏳ Запуск парсинга...\n');
    
    // Запускаем парсинг
    const startPostData = JSON.stringify({ accessToken: token });
    
    const startOptions = {
      hostname: 'localhost',
      port: 3001,
      path: `/api/tasks/${result.taskId}/start`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(startPostData)
      }
    };
    
    http.request(startOptions, (res) => {
      let startResponseData = '';
      res.on('data', (chunk) => startResponseData += chunk);
      res.on('end', () => {
        console.log('📡 Парсинг запущен!');
        console.log('⏳ Ожидание 60 секунд...\n');
        
        // Ждём 60 секунд и проверяем результат
        setTimeout(() => {
          http.get('http://localhost:3001/api/tasks', (res) => {
            let tasksData = '';
            res.on('data', (chunk) => tasksData += chunk);
            res.on('end', () => {
              const tasks = JSON.parse(tasksData);
              const task = tasks.find(t => t.id === result.taskId);
              console.log('=== РЕЗУЛЬТАТ ===');
              console.log(`Статус: ${task.status}`);
              console.log(`Найдено пользователей: ${task.total_found}`);
              console.log(`Город: ${task.city_name}`);
              console.log(`Параметры: ${task.min_age}-${task.max_age} лет, ${task.min_followers}-${task.max_followers} подписчиков`);
            });
          });
        }, 60000);
      });
    }).on('error', (e) => {
      console.error('❌ Ошибка запуска:', e.message);
    }).write(startPostData);
  });
});

createReq.on('error', (e) => {
  console.error('❌ Ошибка:', e.message);
});

createReq.write(createPostData);
createReq.end();
