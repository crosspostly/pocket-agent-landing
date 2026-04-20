// Общие типы для сервера (без зависимостей от src)

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
  status?: string;
}

export interface SearchFilters {
  cityId: number;
  minAge: number;
  maxAge?: number;
  minFollowers: number;
  maxFollowers: number;
  hasPhoto?: boolean;
}

export const CITIES = {
  nizhnyNovgorod: { id: 98, name: 'Нижний Новгород' },
  kemerovo: { id: 64, name: 'Кемерово' }
};
