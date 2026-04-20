import axios from 'axios';

const VK_API_VERSION = '5.199';
const VK_API_URL = 'https://api.vk.com/method';

/**
 * VK API Execute метод для батчевых запросов
 * Позволяет делать до 25 запросов в одном вызове
 */
export class VKExecuteClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Выполняет батч запрос через execute с fallback системой при flood control
   */
  async executeBatch<T>(vkScriptCode: string, retryCount: number = 0): Promise<T> {
    try {
      const response = await axios.get(`${VK_API_URL}/execute`, {
        params: {
          access_token: this.accessToken,
          v: VK_API_VERSION,
          code: vkScriptCode
        }
      });

      if (response.data.error) {
        const errorMsg = response.data.error.error_msg;
        
        // Flood control — используем нарастающую задержку
        if (errorMsg.includes('Flood control')) {
          const baseDelay = 5000; // 5 секунд база
          const exponentialDelay = baseDelay * Math.pow(2, retryCount); // 5s, 10s, 20s, 40s
          const maxDelay = 120000; // максимум 2 минуты
          const delay = Math.min(exponentialDelay, maxDelay);
          
          console.log(`⏳ Flood control. Ожидание ${delay/1000} секунд (попытка ${retryCount + 1})...`);
          await this.delay(delay);
          
          // Пробуем снова
          return this.executeBatch<T>(vkScriptCode, retryCount + 1);
        }
        
        throw new Error(`VK Execute Error: ${errorMsg}`);
      }

      return response.data.response;
    } catch (error: any) {
      // Если это flood control и еще не превысили лимит попыток
      if (error.message?.includes('Flood control') && retryCount < 5) {
        const baseDelay = 5000;
        const exponentialDelay = baseDelay * Math.pow(2, retryCount);
        const delay = Math.min(exponentialDelay, 120000);
        
        console.log(`⏳ Flood control (catch). Ожидание ${delay/1000} секунд...`);
        await this.delay(delay);
        return this.executeBatch<T>(vkScriptCode, retryCount + 1);
      }
      
      console.error('Execute batch error:', error);
      throw error;
    }
  }

  /**
   * Получает информацию о нескольких пользователях одним запросом
   * Максимум 1000 user_ids за раз (ограничение VK API)
   */
  async getUsersBatch(userIds: number[], fields: string[]): Promise<any[]> {
    const chunks = this.chunkArray(userIds, 1000);
    const results: any[] = [];

    for (const chunk of chunks) {
      const code = `
        return API.users.get({
          "user_ids": "${chunk.join(',')}",
          "fields": "${fields.join(',')}"
        });
      `;

      const users = await this.executeBatch<any[]>(code);
      results.push(...users);

      // Задержка между батчами
      await this.delay(1000);
    }

    return results;
  }

  /**
   * Поиск пользователей с пагинацией через execute
   * Можно объединить до 25 поисковых запросов
   */
  async searchUsersBatch(
    cityId: number,
    minAge: number,
    offsets: number[],
    count: number = 100,
    fields: string[]
  ): Promise<any[]> {
    // Формируем до 25 поисковых запросов
    const requests = offsets.slice(0, 25).map((offset, index) => {
      return `var result${index} = API.users.search({
        "city_id": ${cityId},
        "country": 1,
        "age_from": ${minAge},
        "count": ${count},
        "offset": ${offset},
        "fields": "${fields.join(',')}",
        "has_photo": 1,
        "sort": 0
      });`;
    });

    const code = `
      ${requests.join(';\n')};
      return [${offsets.slice(0, 25).map((_, i) => `result${i}`).join(', ')}];
    `;

    return this.executeBatch<any[]>(code);
  }

  /**
   * Получает followers_count для множества пользователей
   * Используя execute для экономии запросов
   */
  async getFollowersCountBatch(userIds: number[]): Promise<Map<number, number>> {
    const result = new Map<number, number>();
    
    // Разбиваем на батчи по 25 пользователей (лимит execute)
    const chunks = this.chunkArray(userIds, 25);

    for (const chunk of chunks) {
      const requests = chunk.map((userId, index) => {
        return `var followers${index} = API.users.getFollowers({"user_id": ${userId}, "count": 1});`;
      });

      const returns = chunk.map((userId, index) => {
        return `"${userId}": followers${index}.count`;
      });

      const code = `
        ${requests.join(';\n')};
        return {${returns.join(', ')}};
      `;

      try {
        const response = await this.executeBatch<Record<string, number>>(code);
        
        Object.entries(response).forEach(([userId, count]) => {
          result.set(parseInt(userId), count);
        });
      } catch (error) {
        console.warn('Error getting followers batch:', error);
      }

      // Задержка между батчами
      await this.delay(1000);
    }

    return result;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Оптимизированный VK API клиент с использованием execute
 * 
 * Изменения (март 2026):
 * - Используем параметр 'city' вместо устаревшего 'city_id'
 * - Поддержка поиска по названию города (hometown)
 * - Поддержка поиска по всем городам (без фильтра city)
 */

export interface SearchOptions {
  cityId?: number;        // ID города (параметр city)
  cityName?: string;      // Название города (параметр hometown)
  searchAllCities?: boolean; // Искать по всем городам (без фильтра)
  countryId?: number;     // ID страны (по умолчанию Россия = 1)
}

// Стратегии поиска — теперь ОДНА стратегия (без разделения по возрастам)
interface SearchStrategy {
  name: string;
  params: (offset: number) => any;
}

export async function optimizedUserSearch(
  accessToken: string,
  options: SearchOptions & {
    minAge: number;
    maxAge?: number;
    minFollowers: number;
    maxFollowers: number;
  },
  onProgress?: (found: number, total: number) => void
): Promise<any[]> {
  const executeClient = new VKExecuteClient(accessToken);
  const results: Map<number, any> = new Map();

  const {
    cityId,
    cityName,
    searchAllCities = false,
    countryId = 1,
    minAge,
    maxAge,
    minFollowers,
    maxFollowers
  } = options;

  // Определяем локацию для логирования
  let searchLocation: string;
  if (searchAllCities) {
    searchLocation = 'Все города';
  } else if (cityName) {
    searchLocation = `Город: ${cityName}`;
  } else if (cityId) {
    searchLocation = `ID города: ${cityId}`;
  } else {
    searchLocation = 'Не указано';
  }

  console.log(`Starting search: ${searchLocation}, age ${minAge}-${maxAge || 60}, followers ${minFollowers}-${maxFollowers}`);

  // ОДНА стратегия — ищем по всему диапазону возраста
  const effectiveMaxAge = maxAge || 60;

  const strategies: SearchStrategy[] = [
    // Один поиск по всему диапазону
    { name: 'main', params: (offset: number) => ({ age_from: minAge, age_to: effectiveMaxAge, offset }) },
  ];

  const fields = ['followers_count', 'city', 'country', 'bdate', 'sex', 'photo_200', 'photo_100', 'screen_name', 'last_seen', 'photo_count'];

  for (const strategy of strategies) {
    console.log(`Strategy: ${strategy.name}`);
    let offset = 0;
    const maxPerStrategy = 1000; // Лимит VK API на один запрос
    let emptyResultsCount = 0;
    const MAX_EMPTY_RESULTS = 10; // Увеличил с 3 до 10

    while (offset < maxPerStrategy && emptyResultsCount < MAX_EMPTY_RESULTS) {
      try {
        // Батч из 10 запросов по 100 пользователей = 1000 за один execute
        const batchOffsets = Array.from({ length: 10 }, (_, i) => offset + i * 100);

        const requests = batchOffsets.map((off, idx) => {
          const params = strategy.params(off);
          
          // Формируем параметры для VK API
          // Используем 'city' вместо 'city_id' (актуальная версия API)
          // Если searchAllCities = true, не указываем city вообще
          let cityParam = '';
          if (!searchAllCities && cityId) {
            cityParam = `"city": ${cityId},`;
          } else if (!searchAllCities && cityName) {
            // Поиск по названию города (hometown)
            cityParam = `"hometown": "${cityName.replace(/"/g, '\\"')}",`;
          }

          return `var r${idx} = API.users.search({
            ${cityParam}
            ${!searchAllCities ? `"country": ${countryId},` : ''}
            "count": 100,
            "offset": ${off},
            "fields": "${fields.join(',')}",
            "has_photo": 1,
            ${params.age_from ? `"age_from": ${params.age_from},` : ''}
            ${params.age_to ? `"age_to": ${params.age_to},` : ''}
            ${params.online ? `"online": 1,` : ''}
            "sort": 0
          });`;
        });

        const code = `${requests.join(';\n')}; return [${batchOffsets.map((_, i) => `r${i}`).join(', ')}];`;

        const batchResults = await executeClient.executeBatch<any[]>(code);
        let foundInBatch = 0;

        for (const searchResult of batchResults) {
          if (searchResult && searchResult.items) {
            for (const user of searchResult.items) {
              // VK API уже отфильтровал по возрасту, городу
              // Но нам нужны дополнительные фильтры для качества

              // === ФИЛЬТР 1: Реальное имя (без пробелов) ===
              const hasRealName = !!(user.first_name && user.last_name &&
                !user.first_name.includes(' ') &&
                !user.last_name.includes(' '));
              if (!hasRealName) continue;

              // === ФИЛЬТР 2: Фотография есть ===
              if (!user.photo_200) continue;

              // === ФИЛЬТР 3: Больше 3 фотографий ===
              const photoCount = user.photo_count || 0;
              if (photoCount < 3) continue;

              // === ФИЛЬТР 4: Был онлайн < 30 дней назад ===
              if (!user.last_seen || !user.last_seen.time) continue;
              const lastSeenTime = user.last_seen.time * 1000;
              const now = Date.now();
              const daysSinceLastSeen = (now - lastSeenTime) / (1000 * 60 * 60 * 24);
              if (daysSinceLastSeen > 30) continue;

              // === ФИЛЬТР 5: Не совсем пустой аккаунт ===
              const followers = user.followers_count || 0;
              if (followers < 10) continue;

              // Добавляем если еще нет
              if (!results.has(user.id)) {
                results.set(user.id, user);
                foundInBatch++;
              }
            }
          }
        }

        if (foundInBatch === 0) {
          emptyResultsCount++;
        } else {
          emptyResultsCount = 0;
        }

        if (onProgress) {
          onProgress(results.size, maxPerStrategy * strategies.length);
        }

        offset += 1000;

        // Базовая задержка между батчами (fallback система регулирует при flood control)
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Strategy ${strategy.name} error at offset ${offset}:`, error);
        break;
      }
    }

    console.log(`Strategy ${strategy.name} done. Total unique: ${results.size}`);
    
    // Базовая задержка между стратегиями (fallback система регулирует при flood control)
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  const finalResults = Array.from(results.values());
  console.log(`VK API нашёл: ${finalResults.length} уникальных пользователей`);
  
  // === ДОПОЛНИТЕЛЬНЫЙ ЗАПРОС: получаем friends_count ===
  console.log('Получаем количество друзей для пользователей...');
  const userIds = finalResults.map(u => u.id);
  const friendsData = await getFriendsCountBatch(executeClient, userIds);
  
  // Добавляем friends_count к каждому пользователю
  const usersWithFriends = finalResults.map(user => {
    const friendsCount = friendsData.get(user.id) || 0;
    const totalAudience = (user.followers_count || 0) + friendsCount;
    return {
      ...user,
      friends_count: friendsCount,
      total_audience: totalAudience
    };
  });
  
  // Фильтруем по общей аудитории (друзья + подписчики) — ЭТО ГЛАВНЫЙ ФИЛЬТР
  const filteredByTotal = usersWithFriends.filter(user => {
    return user.total_audience >= minFollowers && user.total_audience <= maxFollowers;
  });
  
  console.log(`✅ После фильтрации по аудитории (друзья+подписчики ${minFollowers}-${maxFollowers}): ${filteredByTotal.length} пользователей`);
  
  return filteredByTotal;
}

/**
 * Получает friends_count для списка пользователей через execute
 */
async function getFriendsCountBatch(
  executeClient: VKExecuteClient,
  userIds: number[]
): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  
  // Разбиваем на батчи по 1000 (лимит VK API на users.get)
  const chunks: number[][] = [];
  for (let i = 0; i < userIds.length; i += 1000) {
    chunks.push(userIds.slice(i, i + 1000));
  }
  
  for (const chunk of chunks) {
    try {
      const code = `
        return API.users.get({
          "user_ids": "${chunk.join(',')}",
          "fields": "friends_count"
        });
      `;
      
      const users = await executeClient.executeBatch<any[]>(code);
      
      for (const user of users) {
        if (user && user.id) {
          result.set(user.id, user.friends_count || 0);
        }
      }
      
      console.log(`Получено друзей для ${chunk.length} пользователей (всего: ${result.size})`);
      
      // Задержка между батчами
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error('Error getting friends count batch:', error);
    }
  }
  
  return result;
}

function calculateAge(bdate: string): number | null {
  if (!bdate) return null;
  const parts = bdate.split('.');
  if (parts.length < 3) return null;
  const birthYear = parseInt(parts[2]);
  return new Date().getFullYear() - birthYear;
}
