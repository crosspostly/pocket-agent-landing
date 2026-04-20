const http = require('http');

http.get('http://localhost:3001/api/tasks', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const tasks = JSON.parse(data);
    console.log('=== Задачи ===');
    tasks.forEach(task => {
      console.log(`ID: ${task.id}, Город: ${task.city_name}, Найдено: ${task.total_found}, Статус: ${task.status}`);
    });
  });
});
