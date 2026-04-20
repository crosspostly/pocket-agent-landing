const http = require('http');
const fs = require('fs');
const path = require('path');

// Читаем токен из .env
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const tokenMatch = envContent.match(/VK_ACCESS_TOKEN=(.+)/);
const token = tokenMatch[1].trim();

console.log('=== Запуск парсинга ===');
console.log('Токен:', token.substring(0, 30) + '...');

// Сначала создаём задачу
const createData = {
  cityName: 'Москва',
  minAge: 23,
  maxAge: 35,
  minFollowers: 1000,
  maxFollowers: 10000,
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
    
    // Теперь запускаем парсинг
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
    
    const startReq = http.request(startOptions, (res) => {
      let startResponseData = '';
      res.on('data', (chunk) => startResponseData += chunk);
      res.on('end', () => {
        console.log('📡 Ответ запуска:', startResponseData);
        try {
          const startResult = JSON.parse(startResponseData);
          if (startResult.error) {
            console.error('❌ ОШИБКА ЗАПУСКА:', startResult.error);
          } else {
            console.log('✅ Парсинг запущен!');
          }
        } catch (e) {
          console.error('❌ Ошибка парсинга JSON:', e.message);
        }
      });
    });
    
    startReq.on('error', (e) => {
      console.error('❌ Ошибка подключения:', e.message);
    });
    
    startReq.write(startPostData);
    startReq.end();
  });
});

createReq.on('error', (e) => {
  console.error('❌ Ошибка подключения:', e.message);
});

createReq.write(createPostData);
createReq.end();
