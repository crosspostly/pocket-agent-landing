const http = require('http');
const fs = require('fs');
const path = require('path');

const token = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(/VK_ACCESS_TOKEN=(.+)/)[1].trim();

console.log('=== ТЕСТ С НОВЫМИ ФИЛЬТРАМИ ===');
console.log('Параметры: Москва, 20-45 лет, 500-50000 подписчиков');
console.log('Фильтры: фото > 3, онлайн < 30 дней, реальное имя\n');

const createData = {
  cityName: 'Москва',
  minAge: 20,
  maxAge: 45,
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
        console.log('⏳ Ожидание 90 секунд (6 стратегий с задержками)...\n');
        
        // Проверяем прогресс каждые 15 секунд
        let elapsed = 0;
        const interval = setInterval(() => {
          elapsed += 15;
          http.get('http://localhost:3001/api/tasks', (res) => {
            let tasksData = '';
            res.on('data', (chunk) => tasksData += chunk);
            res.on('end', () => {
              const tasks = JSON.parse(tasksData);
              const task = tasks.find(t => t.id === result.taskId);
              if (task) {
                console.log(`[${elapsed}с] Статус: ${task.status}, Найдено: ${task.total_found}`);
                if (task.status === 'completed') {
                  clearInterval(interval);
                  console.log('\n=== РЕЗУЛЬТАТ ===');
                  console.log(`✅ Найдено пользователей: ${task.total_found}`);
                  console.log(`Город: ${task.city_name}`);
                  console.log(`Параметры: ${task.min_age}-${task.max_age} лет, ${task.min_followers}-${task.max_followers} подписчиков`);
                }
              }
            });
          });
        }, 15000);
        
        // Останавливаем через 2 минуты
        setTimeout(() => clearInterval(interval), 120000);
        
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
