import axios from 'axios';

const VK_API_VERSION = '5.199';
const VK_API_URL = 'https://api.vk.com/method';

export interface VKUser {
  id: number;
  first_name: string;
  last_name: string;
  screen_name?: string;
  followers_count?: number;
  city?: { id: number; title: string };
  country?: { id: number; title: string };
  bdate?: string;
  sex?: number;
  about?: string;
  activities?: string;
  interests?: string;
  photo_200?: string;
  last_seen?: { time: number };
  can_write_private_message?: number;
}

export interface SearchFilters {
  cityId: number;
  minAge: number;
  minFollowers: number;
  maxFollowers: number;
  hasPhoto?: boolean;
}

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
    const hasRealName = !!(user.first_name && user.last_name && 
                       !user.first_name.includes(' ') && 
                       !user.last_name.includes(' '));
    
    const hasActivity = !!(user.activities || user.interests || user.about);
    
    const hasReasonableFollowers = (user.followers_count || 0) < 100000;
    
    return hasRealName && hasActivity && hasReasonableFollowers;
  }

  calculateAge(bdate: string | undefined): number | null {
    if (!bdate) return null;
    
    const parts = bdate.split('.');
    if (parts.length < 3) return null;
    
    const birthYear = parseInt(parts[2]);
    const currentYear = new Date().getFullYear();
    
    return currentYear - birthYear;
  }
}

export const CITIES = {
  nizhnyNovgorod: { id: 98, name: 'Нижний Новгород' },
  kemerovo: { id: 64, name: 'Кемерово' }
};
