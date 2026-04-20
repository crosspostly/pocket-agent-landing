import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { VKUser } from './types';

export interface SearchTask {
  id?: number;
  city_id?: number;  // Теперь необязательно (для поиска по всем городам)
  city_name: string;
  city_name_input?: string;  // Введённое пользователем название города
  search_all_cities?: boolean; // Поиск по всем городам
  min_age: number;
  max_age?: number;
  min_followers: number;
  max_followers: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at?: string;
  completed_at?: string;
  total_found: number;
  error_message?: string;
}

export interface CachedUser {
  id: number;
  task_id: number;
  vk_id: number;
  first_name: string;
  last_name: string;
  screen_name?: string;
  followers_count: number;
  friends_count?: number;
  total_audience?: number;
  city?: string;
  country?: string;
  age?: number;
  sex?: number;
  about?: string;
  activities?: string;
  interests?: string;
  photo_url?: string;
  profile_url: string;
  created_at?: string;
}

class DatabaseManager {
  private db: Database<sqlite3.Database, sqlite3.Statement> | null = null;

  async init(): Promise<void> {
    this.db = await open({
      filename: './data/influencers.db',
      driver: sqlite3.Database
    });

    await this.createTables();
    await this.migrateTables();
  }

  private async createTables(): Promise<void> {
    await this.db!.exec(`
      CREATE TABLE IF NOT EXISTS search_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        city_id INTEGER,
        city_name TEXT NOT NULL,
        city_name_input TEXT,
        search_all_cities INTEGER DEFAULT 0,
        min_age INTEGER DEFAULT 23,
        max_age INTEGER,
        min_followers INTEGER DEFAULT 1000,
        max_followers INTEGER DEFAULT 10000,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        total_found INTEGER DEFAULT 0,
        error_message TEXT
      );

      CREATE TABLE IF NOT EXISTS cached_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        vk_id INTEGER NOT NULL UNIQUE,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        screen_name TEXT,
        followers_count INTEGER DEFAULT 0,
        friends_count INTEGER DEFAULT 0,
        total_audience INTEGER DEFAULT 0,
        city TEXT,
        country TEXT,
        age INTEGER,
        sex INTEGER,
        about TEXT,
        activities TEXT,
        interests TEXT,
        photo_url TEXT,
        profile_url TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES search_tasks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_cached_users_task ON cached_users(task_id);
      CREATE INDEX IF NOT EXISTS idx_cached_users_followers ON cached_users(followers_count);
      CREATE INDEX IF NOT EXISTS idx_cached_users_city ON cached_users(city);
    `);
  }

  private async migrateTables(): Promise<void> {
    // Проверяем существует ли таблица и правильная ли схема
    try {
      // Проверяем тип колонки city_id
      const tableInfo = await this.db!.all("PRAGMA table_info(search_tasks)");
      const cityIdColumn = tableInfo.find((col: any) => col.name === 'city_id');
      
      // Если city_id имеет NOT NULL (notnull = 1), нужно пересоздать таблицу
      if (cityIdColumn && cityIdColumn.notnull === 1) {
        console.log('Migration: Пересоздание таблицы search_tasks...');
        await this.db!.exec(`
          DROP TABLE IF EXISTS search_tasks;
          CREATE TABLE search_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            city_id INTEGER,
            city_name TEXT NOT NULL,
            city_name_input TEXT,
            search_all_cities INTEGER DEFAULT 0,
            min_age INTEGER DEFAULT 23,
            max_age INTEGER,
            min_followers INTEGER DEFAULT 1000,
            max_followers INTEGER DEFAULT 10000,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            total_found INTEGER DEFAULT 0,
            error_message TEXT
          );
        `);
        console.log('Migration: Таблица search_tasks пересоздана');
        return;
      }
    } catch (e: any) {
      console.error('Migration check error:', e);
    }

    // Добавляем колонку max_age если её нет
    try {
      await this.db!.exec(`ALTER TABLE search_tasks ADD COLUMN max_age INTEGER;`);
      console.log('Migration: added max_age column');
    } catch (e: any) {
      if (!e.message.includes('duplicate column')) {
        console.error('Migration error:', e);
      }
    }

    // Добавляем колонку city_name_input если её нет
    try {
      await this.db!.exec(`ALTER TABLE search_tasks ADD COLUMN city_name_input TEXT;`);
      console.log('Migration: added city_name_input column');
    } catch (e: any) {
      if (!e.message.includes('duplicate column')) {
        console.error('Migration error:', e);
      }
    }

    // Добавляем колонку search_all_cities если её нет
    try {
      await this.db!.exec(`ALTER TABLE search_tasks ADD COLUMN search_all_cities INTEGER DEFAULT 0;`);
      console.log('Migration: added search_all_cities column');
    } catch (e: any) {
      if (!e.message.includes('duplicate column')) {
        console.error('Migration error:', e);
      }
    }

    // Добавляем колонку friends_count если её нет
    try {
      await this.db!.exec(`ALTER TABLE cached_users ADD COLUMN friends_count INTEGER DEFAULT 0;`);
      console.log('Migration: added friends_count column');
    } catch (e: any) {
      if (!e.message.includes('duplicate column')) {
        console.error('Migration error:', e);
      }
    }

    // Добавляем колонку total_audience если её нет
    try {
      await this.db!.exec(`ALTER TABLE cached_users ADD COLUMN total_audience INTEGER DEFAULT 0;`);
      console.log('Migration: added total_audience column');
    } catch (e: any) {
      if (!e.message.includes('duplicate column')) {
        console.error('Migration error:', e);
      }
    }
  }

  async createTask(task: Omit<SearchTask, 'id' | 'created_at'>): Promise<number> {
    const result = await this.db!.run(
      `INSERT INTO search_tasks (city_id, city_name, city_name_input, search_all_cities, min_age, max_age, min_followers, max_followers, status, total_found)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.city_id || null,
        task.city_name,
        task.city_name_input || null,
        task.search_all_cities ? 1 : 0,
        task.min_age,
        task.max_age || null,
        task.min_followers,
        task.max_followers,
        task.status,
        task.total_found
      ]
    );
    return result.lastID!;
  }

  async updateTaskStatus(
    taskId: number, 
    status: SearchTask['status'], 
    totalFound?: number, 
    errorMessage?: string
  ): Promise<void> {
    const updates: string[] = ['status = ?'];
    const values: any[] = [status];

    if (status === 'completed' || status === 'failed') {
      updates.push('completed_at = CURRENT_TIMESTAMP');
    }

    if (totalFound !== undefined) {
      updates.push('total_found = ?');
      values.push(totalFound);
    }

    if (errorMessage) {
      updates.push('error_message = ?');
      values.push(errorMessage);
    }

    values.push(taskId);

    await this.db!.run(
      `UPDATE search_tasks SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }

  async getTask(taskId: number): Promise<SearchTask | undefined> {
    return this.db!.get<SearchTask>('SELECT * FROM search_tasks WHERE id = ?', taskId);
  }

  async getAllTasks(): Promise<SearchTask[]> {
    return this.db!.all<SearchTask[]>(
      'SELECT * FROM search_tasks ORDER BY created_at DESC'
    );
  }

  async saveUsers(taskId: number, users: VKUser[]): Promise<void> {
    const stmt = await this.db!.prepare(`
      INSERT OR REPLACE INTO cached_users
      (task_id, vk_id, first_name, last_name, screen_name, followers_count, friends_count, total_audience, city, country, age, sex, about, activities, interests, photo_url, profile_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const user of users) {
      const age = this.calculateAge(user.bdate);
      const profileUrl = user.screen_name
        ? `https://vk.com/${user.screen_name}`
        : `https://vk.com/id${user.id}`;
      const friendsCount = (user as any).friends_count || 0;
      const totalAudience = (user as any).total_audience || user.followers_count || 0;

      await stmt.run([
        taskId,
        user.id,
        user.first_name,
        user.last_name,
        user.screen_name || null,
        user.followers_count || 0,
        friendsCount,
        totalAudience,
        user.city?.title || null,
        user.country?.title || null,
        age,
        user.sex || null,
        user.about || null,
        user.activities || null,
        user.interests || null,
        user.photo_200 || null,
        profileUrl
      ]);
    }

    await stmt.finalize();
  }

  async getUsersByTask(taskId: number): Promise<CachedUser[]> {
    return this.db!.all<CachedUser[]>(
      'SELECT * FROM cached_users WHERE task_id = ? ORDER BY followers_count DESC',
      taskId
    );
  }

  async getUsersByFilters(filters: {
    city?: string;
    minFollowers?: number;
    maxFollowers?: number;
    minAge?: number;
    maxAge?: number;
  }): Promise<CachedUser[]> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (filters.city) {
      conditions.push('city = ?');
      values.push(filters.city);
    }

    if (filters.minFollowers !== undefined) {
      conditions.push('followers_count >= ?');
      values.push(filters.minFollowers);
    }

    if (filters.maxFollowers !== undefined) {
      conditions.push('followers_count <= ?');
      values.push(filters.maxFollowers);
    }

    if (filters.minAge !== undefined) {
      conditions.push('age >= ?');
      values.push(filters.minAge);
    }

    if (filters.maxAge !== undefined) {
      conditions.push('age <= ?');
      values.push(filters.maxAge);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return this.db!.all<CachedUser[]>(
      `SELECT * FROM cached_users ${whereClause} ORDER BY followers_count DESC`,
      values
    );
  }

  async deleteTask(taskId: number): Promise<void> {
    // Сначала удаляем пользователей задачи (из-за foreign key)
    await this.db!.run('DELETE FROM cached_users WHERE task_id = ?', taskId);
    // Затем удаляем саму задачу
    await this.db!.run('DELETE FROM search_tasks WHERE id = ?', taskId);
  }

  async getStats(): Promise<{ totalUsers: number; totalTasks: number; cities: string[] }> {
    const totalUsers = await this.db!.get<{ count: number }>('SELECT COUNT(*) as count FROM cached_users');
    const totalTasks = await this.db!.get<{ count: number }>('SELECT COUNT(*) as count FROM search_tasks');
    const cities = await this.db!.all<{ city: string }[]>('SELECT DISTINCT city FROM cached_users WHERE city IS NOT NULL');

    return {
      totalUsers: totalUsers?.count || 0,
      totalTasks: totalTasks?.count || 0,
      cities: cities.map((c: { city: string }) => c.city).filter(Boolean)
    };
  }

  private calculateAge(bdate: string | undefined): number | null {
    if (!bdate) return null;
    
    const parts = bdate.split('.');
    if (parts.length < 3) return null;
    
    const birthYear = parseInt(parts[2]);
    const currentYear = new Date().getFullYear();
    
    return currentYear - birthYear;
  }
}

export const db = new DatabaseManager();
