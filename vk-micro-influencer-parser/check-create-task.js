const http = require('http');

// Проверяем создание задачи
const testData = {
  cityName: 'Москва',
  minAge: 23,
  maxAge: 35,
  minFollowers: 1000,
  maxFollowers: 10000,
  searchAllCities: false
};

console.log('=== Создание задачи ===');
console.log('Данные:', JSON.stringify(testData, null, 2));

const postData = JSON.stringify(testData);

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/tasks',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  console.log('\n📡 Статус ответа:', res.statusCode);
  
  let responseData = '';
  res.on('data', (chunk) => responseData += chunk);
  res.on('end', () => {
    console.log('📡 Ответ сервера:', responseData);
    
    try {
      const result = JSON.parse(responseData);
      if (result.error) {
        console.error('\n❌ ОШИБКА:', result.error);
      } else {
        console.log('\n✅ Задача создана! ID:', result.taskId);
      }
    } catch (e) {
      console.error('❌ Ошибка парсинга JSON:', e.message);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Ошибка подключения:', e.message);
});

req.write(postData);
req.end();
