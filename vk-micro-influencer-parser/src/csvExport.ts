import type { VKUser } from './vkApi';

export function exportToCSV(users: VKUser[], filename: string = 'micro_influencers.csv'): void {
  const headers = [
    'ID',
    'Имя',
    'Фамилия',
    'Ссылка',
    'Подписчики',
    'Город',
    'Страна',
    'Возраст',
    'Пол',
    'О себе',
    'Деятельность',
    'Интересы',
    'Фото'
  ];

  const rows = users.map(user => {
    const age = calculateAge(user.bdate);
    const gender = user.sex === 1 ? 'Женский' : user.sex === 2 ? 'Мужской' : 'Не указан';
    const profileUrl = user.screen_name ? `https://vk.com/${user.screen_name}` : `https://vk.com/id${user.id}`;
    
    return [
      user.id,
      escapeCsv(user.first_name),
      escapeCsv(user.last_name),
      profileUrl,
      user.followers_count || 0,
      escapeCsv(user.city?.title || ''),
      escapeCsv(user.country?.title || ''),
      age || '',
      gender,
      escapeCsv(user.about || ''),
      escapeCsv(user.activities || ''),
      escapeCsv(user.interests || ''),
      user.photo_200 || ''
    ];
  });

  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.join(';'))
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function escapeCsv(value: string): string {
  if (!value) return '';
  
  if (value.includes(';') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  
  return value;
}

function calculateAge(bdate: string | undefined): number | null {
  if (!bdate) return null;
  
  const parts = bdate.split('.');
  if (parts.length < 3) return null;
  
  const birthYear = parseInt(parts[2]);
  const currentYear = new Date().getFullYear();
  
  return currentYear - birthYear;
}
