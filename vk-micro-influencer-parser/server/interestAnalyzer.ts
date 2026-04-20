// Категории интересов для анализа
export const INTEREST_CATEGORIES = {
  beauty: {
    keywords: ['красота', 'макияж', 'косметика', 'уход', 'прически', 'маникюр', 'педикюр', 'салон', 'стилист', 'визажист'],
    weight: 1.5
  },
  fashion: {
    keywords: ['мода', 'стиль', 'одежда', 'бренд', 'look', 'outfit', 'шопинг', 'тренд', 'аксессуары'],
    weight: 1.5
  },
  fitness: {
    keywords: ['фитнес', 'спорт', 'тренировки', 'зал', 'йога', 'бег', 'питание', 'здоровье', 'диета', 'похудение'],
    weight: 1.5
  },
  travel: {
    keywords: ['путешествия', 'туризм', 'отдых', 'отпуск', 'города', 'страны', 'отели', 'авиа', 'поездки'],
    weight: 1.3
  },
  food: {
    keywords: ['еда', 'кулинария', 'рецепты', 'рестораны', 'кафе', 'готовка', 'вкусно', 'кулинар'],
    weight: 1.3
  },
  tech: {
    keywords: ['технологии', 'гаджеты', 'смартфон', 'компьютер', 'it', 'программирование', 'айти', 'digital'],
    weight: 1.4
  },
  business: {
    keywords: ['бизнес', 'предприниматель', 'стартап', 'фриланс', 'заработок', 'инвестиции', 'финансы', 'деньги'],
    weight: 1.4
  },
  parenting: {
    keywords: ['мама', 'папа', 'дети', 'ребенок', 'семья', 'воспитание', 'беременность', 'роды', 'малыш'],
    weight: 1.3
  },
  lifestyle: {
    keywords: ['лайфстайл', 'жизнь', 'блог', 'daily', 'vlog', 'личный блог', 'мой день', 'рутина'],
    weight: 1.2
  },
  art: {
    keywords: ['искусство', 'творчество', 'рисование', 'фото', 'фотография', 'дизайн', 'творческий', 'художник'],
    weight: 1.3
  },
  music: {
    keywords: ['музыка', 'песни', 'концерты', 'певец', 'группа', 'dj', 'танцы', 'плейлист'],
    weight: 1.2
  },
  gaming: {
    keywords: ['игры', 'гейминг', 'игрок', 'stream', 'стрим', 'twitch', 'youtube', 'letsplay'],
    weight: 1.2
  }
};

export interface UserInterests {
  categories: string[];
  scores: Record<string, number>;
  primaryCategory: string;
  confidence: number;
}

export interface AnalyzedUser {
  vk_id: number;
  first_name: string;
  last_name: string;
  followers_count: number;
  interests: UserInterests;
  matchedKeywords: string[];
  relevanceScore: number;
}

/**
 * Анализирует интересы пользователя на основе его данных
 */
export function analyzeUserInterests(user: any): UserInterests {
  const text = [
    user.activities || '',
    user.interests || '',
    user.about || '',
    user.status || ''
  ].join(' ').toLowerCase();

  const scores: Record<string, number> = {};
  const matchedKeywords: string[] = [];

  for (const [category, data] of Object.entries(INTEREST_CATEGORIES)) {
    let score = 0;
    
    for (const keyword of data.keywords) {
      const regex = new RegExp(keyword, 'gi');
      const matches = text.match(regex);
      if (matches) {
        score += matches.length * data.weight;
        matchedKeywords.push(keyword);
      }
    }

    if (score > 0) {
      scores[category] = score;
    }
  }

  // Сортируем категории по score
  const sortedCategories = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);

  const primaryCategory = sortedCategories[0] || 'unknown';
  const confidence = scores[primaryCategory] || 0;

  return {
    categories: sortedCategories,
    scores,
    primaryCategory,
    confidence
  };
}

/**
 * Фильтрует пользователей по интересам
 */
export function filterByInterests(
  users: any[],
  targetCategories?: string[],
  minConfidence: number = 1
): AnalyzedUser[] {
  const analyzed: AnalyzedUser[] = users.map(user => {
    const interests = analyzeUserInterests(user);
    return {
      vk_id: user.id || user.vk_id,
      first_name: user.first_name,
      last_name: user.last_name,
      followers_count: user.followers_count,
      interests,
      matchedKeywords: [],
      relevanceScore: interests.confidence
    };
  });

  if (!targetCategories || targetCategories.length === 0) {
    return analyzed.filter(u => u.interests.confidence >= minConfidence);
  }

  return analyzed.filter(u => {
    const hasTargetInterest = targetCategories.some(cat => 
      u.interests.categories.includes(cat)
    );
    return hasTargetInterest && u.interests.confidence >= minConfidence;
  });
}

/**
 * Поиск по ключевым словам в профиле
 */
export function searchByKeywords(users: any[], keywords: string[]): any[] {
  if (!keywords || keywords.length === 0) return users;

  return users.filter(user => {
    const text = [
      user.activities,
      user.interests,
      user.about,
      user.first_name,
      user.last_name
    ].join(' ').toLowerCase();

    return keywords.some(keyword => 
      text.includes(keyword.toLowerCase())
    );
  });
}

/**
 * Ранжирует пользователей по релевантности для бартерного сотрудничества
 */
export function rankForBarter(users: AnalyzedUser[]): AnalyzedUser[] {
  return users.map(user => {
    let score = user.relevanceScore;

    // Бонус за подписчиков (оптимально для микроблогеров 1000-10000)
    if (user.followers_count >= 1000 && user.followers_count <= 5000) {
      score += 2;
    } else if (user.followers_count > 5000 && user.followers_count <= 10000) {
      score += 1.5;
    }

    // Бонус за активность (наличие интересов)
    if (user.interests.categories.length > 0) {
      score += 1;
    }

    return {
      ...user,
      relevanceScore: score
    };
  }).sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Получает топ категорий в выборке
 */
export function getTopCategories(users: AnalyzedUser[], limit: number = 5): { category: string; count: number }[] {
  const categoryCounts: Record<string, number> = {};

  for (const user of users) {
    for (const cat of user.interests.categories.slice(0, 3)) {
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
  }

  return Object.entries(categoryCounts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
