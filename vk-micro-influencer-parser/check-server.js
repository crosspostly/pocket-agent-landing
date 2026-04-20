const http = require('http');

// Проверяем что сервер отдаёт
console.log('=== Проверка API сервера ===');
http.get('http://localhost:3001/api/token', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const result = JSON.parse(data);
    console.log('Токен с сервера:', result.token);
    console.log('Длина токена:', result.token?.length);
    console.log('');
    
    // Теперь проверяем валидацию через сервер
    console.log('=== Проверка через /api/token/validate ===');
    const postData = JSON.stringify({ token: result.token });
    
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/token/validate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        console.log('Ответ сервера:', responseData);
      });
    });
    
    req.on('error', (e) => {
      console.error('Ошибка:', e.message);
    });
    
    req.write(postData);
    req.end();
  });
}).on('error', (e) => {
  console.error('Ошибка подключения к серверу:', e.message);
});
