import axios from 'axios';
import { VKUser, SearchFilters } from './types';

const VK_API_VERSION = '5.199';
const VK_API_URL = 'https://api.vk.com/method';

export class VKApiClient {
  public accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async searchUsers(filters: SearchFilters, offset: number = 0, count: number = 100): Promise<{ items: VKUser[]; count: number }> {
    const fields = [
      'followers_count',
      'city',
      'country',
      'bdate',
      'sex',
      'about',
      'activities',
      'interests',
      'photo_200',
      'last_seen',
      'can_write_private_message',
      'screen_name'
    ].join(',');

    const params: any = {
      access_token: this.accessToken,
      v: VK_API_VERSION,
      city: filters.cityId,
      age_from: filters.minAge,
      age_to: filters.maxAge || undefined,
      count: count,
      offset: offset,
      fields: fields,
      has_photo: filters.hasPhoto ? 1 : 0,
      online: 0
    };

    try {
      const response = await axios.get(`${VK_API_URL}/users.search`, { params });

      if (response.data.error) {
        throw new Error(`VK API Error: ${response.data.error.error_msg}`);
      }

      return {
        items: response.data.response.items,
        count: response.data.response.count
      };
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  }

  async getUserFollowers(userId: number, count: number = 1000): Promise<number[]> {
    try {
      const response = await axios.get(`${VK_API_URL}/users.getFollowers`, {
        params: {
          access_token: this.accessToken,
          v: VK_API_VERSION,
          user_id: userId,
          count: count
        }
      });

      if (response.data.error) {
        console.warn(`Cannot get followers for user ${userId}: ${response.data.error.error_msg}`);
        return [];
      }

      return response.data.response.items || [];
    } catch (error) {
      console.warn(`Error getting followers for user ${userId}:`, error);
      return [];
    }
  }

  async getUsersInfo(userIds: number[]): Promise<VKUser[]> {
    if (userIds.length === 0) return [];
    
    const fields = [
      'followers_count',
      'city',
      'country',
      'bdate',
      'sex',
      'about',
      'activities',
      'interests',
      'photo_200',
      'screen_name'
    ].join(',');

    try {
      const response = await axios.get(`${VK_API_URL}/users.get`, {
        params: {
          access_token: this.accessToken,
          v: VK_API_VERSION,
          user_ids: userIds.join(','),
          fields: fields
        }
      });

      if (response.data.error) {
        throw new Error(`VK API Error: ${response.data.error.error_msg}`);
      }

      return response.data.response;
    } catch (error) {
      console.error('Error getting users info:', error);
      return [];
    }
  }

  filterMicroInfluencers(users: VKUser[], minFollowers: number, maxFollowers: number): VKUser[] {
    return users.filter(user => {
      const followers = user.followers_count || 0;
      return followers >= minFollowers && followers <= maxFollowers;
    });
  }

  isRealPerson(user: VKUser): boolean {
    // Более мягкая проверка на реального человека
    const hasRealName = !!(user.first_name && user.last_name &&
                       !user.first_name.includes(' ') &&
                       !user.last_name.includes(' '));

    // Убираем требование к activities/interests/about - у многих пустые профили
    // Оставляем только проверку на адекватное имя и разумное количество подписчиков
    const hasReasonableFollowers = (user.followers_count || 0) < 100000;

    return hasRealName && hasReasonableFollowers;
  }

  calculateAge(bdate: string | undefined): number | null {
    if (!bdate) return null;
    
    const parts = bdate.split('.');
    if (parts.length < 3) return null;
    
    const birthYear = parseInt(parts[2]);
    const currentYear = new Date().getFullYear();
    
    return currentYear - birthYear;
  }

  async validateToken(): Promise<{ valid: boolean; user?: any; error?: string }> {
    try {
      const response = await axios.get(`${VK_API_URL}/users.get`, {
        params: {
          access_token: this.accessToken,
          v: VK_API_VERSION,
          fields: 'first_name,last_name,screen_name'
        }
      });

      if (response.data.error) {
        return { valid: false, error: response.data.error.error_msg };
      }

      return { valid: true, user: response.data.response[0] };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }

  async getEstimatedResults(
    cityId?: number,
    minAge: number = 23,
    cityName?: string,
    maxAge?: number
  ): Promise<{ total: number; estimatedTime: number }> {
    try {
      const params: any = {
        access_token: this.accessToken,
        v: VK_API_VERSION,
        count: 1,
        fields: 'followers_count'
      };

      // Добавляем параметры города
      if (!cityId && !cityName) {
        params.country = 1; // Россия по умолчанию
      } else {
        if (cityId) {
          params.city = cityId;
        } else if (cityName) {
          params.hometown = cityName;
        }
      }

      if (minAge) {
        params.age_from = minAge;
      }

      if (maxAge) {
        params.age_to = maxAge;
      }

      const response = await axios.get(`${VK_API_URL}/users.search`, { params });

      if (response.data.error) {
        return { total: 0, estimatedTime: 0 };
      }

      const total = response.data.response.count;
      // Примерно 1000 пользователей в минуту с учетом задержек
      const estimatedTime = Math.ceil(total / 1000) * 60;

      return { total, estimatedTime };
    } catch (error) {
      return { total: 0, estimatedTime: 0 };
    }
  }
}
