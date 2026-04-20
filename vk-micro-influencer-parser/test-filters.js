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
  fields: 'followers_count,city,screen_name,bdate,photo_200,last_seen',
  has_photo: '1'
});

const url = `https://api.vk.com/method/users.search?${params}`;

console.log('=== АНАЛИЗ ФИЛЬТРОВ ===');
console.log('Параметры: Москва, 20-40 лет, 1000-10000 подписчиков\n');

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const result = JSON.parse(data);
    
    if (result.error) {
      console.error('❌ ОШИБКА VK API:', result.error.error_msg);
      return;
    }
    
    const items = result.response.items;
    console.log(`Всего найдено VK API: ${items.length}\n`);
    
    // Считаем статистику по фильтрам
    let stats = {
      total: items.length,
      withFollowers: 0,
      withCity: 0,
      withAge: 0,
      withPhoto: 0,
      withLastSeen: 0,
      withRealName: 0,
      passAll: 0
    };
    
    const minFollowers = 1000;
    const maxFollowers = 10000;
    const minAge = 20;
    const maxAge = 40;
    
    items.forEach((user, i) => {
      const followers = user.followers_count || 0;
      const hasFollowers = followers >= minFollowers && followers <= maxFollowers;
      if (hasFollowers) stats.withFollowers++;
      
      const hasCity = !!user.city;
      if (hasCity) stats.withCity++;
      
      let hasAge = false;
      let inAgeRange = false;
      if (user.bdate) {
        const age = calculateAge(user.bdate);
        if (age) {
          hasAge = true;
          inAgeRange = age >= minAge && age <= maxAge;
        }
      }
      if (hasAge) stats.withAge++;
      
      const hasPhoto = !!user.photo_200;
      if (hasPhoto) stats.withPhoto++;
      
      const hasLastSeen = !!user.last_seen && !!user.last_seen.time;
      let recentActivity = false;
      if (hasLastSeen) {
        const daysSinceLastSeen = (Date.now() - user.last_seen.time * 1000) / (1000 * 60 * 60 * 24);
        recentActivity = daysSinceLastSeen <= 30;
      }
      if (hasLastSeen) stats.withLastSeen++;
      
      const hasRealName = !!(user.first_name && user.last_name && 
        !user.first_name.includes(' ') && !user.last_name.includes(' '));
      if (hasRealName) stats.withRealName++;
      
      // Проходят все фильтры
      if (hasFollowers && hasCity && inAgeRange && hasPhoto && recentActivity && hasRealName) {
        stats.passAll++;
      }
    });
    
    console.log('=== СТАТИСТИКА ===');
    console.log(`С подписчиками ${minFollowers}-${maxFollowers}: ${stats.withFollowers} (${(stats.withFollowers/stats.total*100).toFixed(1)}%)`);
    console.log(`С городом: ${stats.withCity} (${(stats.withCity/stats.total*100).toFixed(1)}%)`);
    console.log(`С возрастом: ${stats.withAge} (${(stats.withAge/stats.total*100).toFixed(1)}%)`);
    console.log(`С фотографией: ${stats.withPhoto} (${(stats.withPhoto/stats.total*100).toFixed(1)}%)`);
    console.log(`С last_seen: ${stats.withLastSeen} (${(stats.withLastSeen/stats.total*100).toFixed(1)}%)`);
    console.log(`С реальным именем: ${stats.withRealName} (${(stats.withRealName/stats.total*100).toFixed(1)}%)`);
    console.log(`\n✅ ПРОХОДЯТ ВСЕ ФИЛЬТРЫ: ${stats.passAll} из ${stats.total}`);
    
    console.log('\n=== ПРИМЕРЫ ===');
    items.slice(0, 5).forEach((user, i) => {
      const age = user.bdate ? calculateAge(user.bdate) : '?';
      const daysAgo = user.last_seen?.time 
        ? Math.floor((Date.now() - user.last_seen.time * 1000) / (1000 * 60 * 60 * 24))
        : '?';
      console.log(`${i+1}. ${user.first_name} ${user.last_name}`);
      console.log(`   Подписчики: ${user.followers_count}`);
      console.log(`   Город: ${user.city?.title || 'не указан'}`);
      console.log(`   Возраст: ${age}`);
      console.log(`   Онлайн: ${daysAgo === '?' ? 'неизвестно' : daysAgo === 0 ? 'сегодня' : daysAgo + ' дн. назад'}`);
      console.log('');
    });
  });
}).on('error', (e) => {
  console.error('❌ Ошибка запроса:', e.message);
});

function calculateAge(bdate) {
  if (!bdate) return null;
  const parts = bdate.split('.');
  if (parts.length < 3) return null;
  const birthYear = parseInt(parts[2]);
  return new Date().getFullYear() - birthYear;
}
