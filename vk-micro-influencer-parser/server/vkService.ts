import { VKApiClient } from './vkApi';
import { VKUser, SearchFilters, CITIES } from './types';
import { db, SearchTask } from './database';
import { optimizedUserSearch, type SearchOptions } from './vkExecute';

export interface ParsingProgress {
  taskId: number;
  isRunning: boolean;
  currentStrategy: string;
  strategiesCompleted: number;
  totalStrategies: number;
  foundUsers: number;
  elapsedTime: number;
  estimatedTimeRemaining: number;
}

export interface ExtendedSearchTask extends SearchTask {
  city_name_input?: string;  // Название города, введённое пользователем
  search_all_cities?: boolean; // Поиск по всем городам
}

export class VKParserService {
  private vkClient: VKApiClient | null = null;
  private isRunning = false;
  private currentTaskId: number | null = null;
  private progress: ParsingProgress | null = null;
  private startTime: number = 0;

  constructor(accessToken: string) {
    this.vkClient = new VKApiClient(accessToken);
  }

  getProgress(): ParsingProgress | null {
    return this.progress;
  }

  async startParsing(taskId: number): Promise<void> {
    if (this.isRunning) {
      throw new Error('Parsing already in progress');
    }

    const task = await db.getTask(taskId) as ExtendedSearchTask | undefined;
    if (!task) {
      throw new Error('Task not found');
    }

    this.isRunning = true;
    this.currentTaskId = taskId;
    this.startTime = Date.now();

    try {
      await db.updateTaskStatus(taskId, 'processing');

      // Инициализируем прогресс
      this.progress = {
        taskId,
        isRunning: true,
        currentStrategy: 'Инициализация...',
        strategiesCompleted: 0,
        totalStrategies: 6, // 6 стратегий поиска
        foundUsers: 0,
        elapsedTime: 0,
        estimatedTimeRemaining: 0
      };

      // Формируем опции для поиска
      const searchOptions: SearchOptions & {
        minAge: number;
        minFollowers: number;
        maxFollowers: number;
      } = {
        minAge: task.min_age,
        minFollowers: task.min_followers,
        maxFollowers: task.max_followers,
        countryId: 1 // Россия по умолчанию
      };

      // Определяем тип поиска
      if (task.search_all_cities) {
        searchOptions.searchAllCities = true;
      } else if (task.city_name_input) {
        // Поиск по названию города
        searchOptions.cityName = task.city_name_input;
      } else if (task.city_id) {
        // Поиск по ID города
        searchOptions.cityId = task.city_id;
      }

      const results = await this.performSearch(searchOptions);

      await db.saveUsers(taskId, results);
      await db.updateTaskStatus(taskId, 'completed', results.length);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await db.updateTaskStatus(taskId, 'failed', 0, errorMessage);
      throw error;
    } finally {
      this.isRunning = false;
      this.currentTaskId = null;
      this.progress = null;
    }
  }

  private async performSearch(options: Parameters<typeof optimizedUserSearch>[1]): Promise<VKUser[]> {
    // Используем оптимизированный поиск через execute
    const results = await optimizedUserSearch(
      this.vkClient!['accessToken'],
      options,
      (found, total) => {
        console.log(`Progress: ${found}/${total}`);
        if (this.progress) {
          this.progress.foundUsers = found;
        }
      }
    );

    // Фильтруем только реальных людей
    return results.filter(user => this.vkClient!.isRealPerson(user));
  }

  async getParsingStatus(): Promise<{ isRunning: boolean; currentTaskId: number | null }> {
    return {
      isRunning: this.isRunning,
      currentTaskId: this.currentTaskId
    };
  }

  stopParsing(): void {
    this.isRunning = false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export async function createParsingTask(
  cityId: number,
  minAge: number = 23,
  minFollowers: number = 1000,
  maxFollowers: number = 10000
): Promise<number> {
  const cityName = Object.values(CITIES).find(c => c.id === cityId)?.name || 'Unknown';

  const taskId = await db.createTask({
    city_id: cityId,
    city_name: cityName,
    min_age: minAge,
    min_followers: minFollowers,
    max_followers: maxFollowers,
    status: 'pending',
    total_found: 0
  });

  return taskId;
}
