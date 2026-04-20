const https = require('https');
const fs = require('fs');
const path = require('path');

// Читаем токен из .env
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const tokenMatch = envContent.match(/VK_ACCESS_TOKEN=(.+)/);

if (!tokenMatch) {
  console.error('❌ Токен не найден в .env');
  process.exit(1);
}

let token = tokenMatch[1].trim();

// Проверяем, не является ли это URL
if (token.includes('access_token=')) {
  const urlMatch = token.match(/access_token=([^&]+)/);
  if (urlMatch) {
    token = urlMatch[1];
    console.log('✅ Извлечён токен из URL');
  }
}

console.log('📝 Токен:', token);
console.log('');

// Проверяем токен через VK API users.get
const checkToken = () => {
  const url = `https://api.vk.com/method/users.get?access_token=${encodeURIComponent(token)}&v=5.199`;
  
  https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        console.log('📡 Ответ VK API:', data);
        console.log('');
        
        if (result.error) {
          console.error('❌ ОШИБКА:', result.error.error_msg);
          console.error('Код ошибки:', result.error.error_code);
        } else if (result.response && result.response[0]) {
          console.log('✅ ТОКЕН РАБОЧИЙ!');
          console.log('User ID:', result.response[0].id);
          console.log('Имя:', result.response[0].first_name, result.response[0].last_name);
        }
      } catch (e) {
        console.error('❌ Ошибка парсинга ответа:', e.message);
      }
    });
  }).on('error', (e) => {
    console.error('❌ Ошибка запроса:', e.message);
  });
};

// Проверяем через users.search (который используется в парсере)
const checkSearch = () => {
  const params = new URLSearchParams({
    access_token: token,
    v: '5.199',
    city: '1',
    age_from: '23',
    age_to: '35',
    count: '1',
    fields: 'followers_count'
  });
  
  const url = `https://api.vk.com/method/users.search?${params}`;
  
  https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        console.log('');
        console.log('📡 Ответ users.search:', data);
        console.log('');
        
        if (result.error) {
          console.error('❌ users.search ОШИБКА:', result.error.error_msg);
          console.error('Код ошибки:', result.error.error_code);
        } else {
          console.log('✅ users.search РАБОТАЕТ!');
          console.log('Найдено профилей:', result.response.count);
        }
      } catch (e) {
        console.error('❌ Ошибка парсинга ответа:', e.message);
      }
    });
  }).on('error', (e) => {
    console.error('❌ Ошибка запроса:', e.message);
  });
};

console.log('=== Проверка токена через users.get ===');
checkToken();

console.log('');
console.log('=== Проверка токена через users.search ===');
checkSearch();
