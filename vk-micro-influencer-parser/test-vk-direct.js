const https = require('https');

const token = 'vk1.a.DRp-Fcl7vdmgc0z37cOlkc8nvQIJefAD_xFSOgZ-2qZUHjlTJ2j9GGDSBr1Oi6mOWOns6IGP5piVEVl3d11JIjX_M9y5IIpklhc1jEZFsKkkygCb8p_9OgS4NQ2o-b8KTw48pj0111s46wOoKBj5hmNazGMvJyO2Zv2fJbC67xlEp2zSERL-waG8KeCPDECTSPhP0qg41PpzY1CsbvYwmQ';

// Прямой запрос к VK API users.search
const params = new URLSearchParams({
  access_token: token,
  v: '5.199',
  city: '1',  // Москва ID = 1
  country: '1',
  age_from: '20',
  age_to: '40',
  count: '100',
  offset: '0',
  fields: 'followers_count,city,screen_name',
  has_photo: '1'
});

const url = `https://api.vk.com/method/users.search?${params}`;

console.log('=== ПРЯМОЙ ЗАПРОС К VK API ===');
console.log('URL:', url.substring(0, 200) + '...\n');

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const result = JSON.parse(data);
    
    if (result.error) {
      console.error('❌ ОШИБКА VK API:', result.error.error_msg);
    } else {
      console.log('✅ Ответ получен!');
      console.log('Всего найдено:', result.response.count);
      console.log('Показано в ответе:', result.response.items.length);
      console.log('\nПервые 5 пользователей:');
      result.response.items.slice(0, 5).forEach((user, i) => {
        console.log(`${i+1}. ${user.first_name} ${user.last_name} (${user.screen_name}) - ${user.followers_count} подписчиков, город: ${user.city?.title || 'не указан'}`);
      });
    }
  });
}).on('error', (e) => {
  console.error('❌ Ошибка запроса:', e.message);
});
