const API_URL = 'http://localhost:3001/api';

export interface Task {
  id: number;
  city_id: number;
  city_name: string;
  min_age: number;
  max_age?: number;
  min_followers: number;
  max_followers: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
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
  city?: string;
  country?: string;
  age?: number;
  sex?: number;
  about?: string;
  activities?: string;
  interests?: string;
  photo_url?: string;
  profile_url: string;
  created_at: string;
}

export interface Stats {
  totalUsers: number;
  totalTasks: number;
  cities: string[];
}

export async function getStats(): Promise<Stats> {
  const response = await fetch(`${API_URL}/stats`);
  if (!response.ok) throw new Error('Failed to get stats');
  return response.json();
}

export async function getTasks(): Promise<Task[]> {
  const response = await fetch(`${API_URL}/tasks`);
  if (!response.ok) throw new Error('Failed to get tasks');
  return response.json();
}

export async function createTask(
  cityId: number | undefined,
  minAge: number = 23,
  minFollowers: number = 1000,
  maxFollowers: number = 10000,
  cityName?: string,
  searchAllCities?: boolean,
  maxAge?: number
): Promise<{ taskId: number }> {
  const response = await fetch(`${API_URL}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cityId,
      cityName,
      searchAllCities,
      minAge,
      minFollowers,
      maxFollowers,
      maxAge
    })
  });
  if (!response.ok) throw new Error('Failed to create task');
  return response.json();
}

export async function startTask(taskId: number, accessToken: string): Promise<void> {
  const response = await fetch(`${API_URL}/tasks/${taskId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken })
  });
  if (!response.ok) throw new Error('Failed to start task');
}

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

export async function getTaskStatus(taskId: number): Promise<{ 
  task: Task; 
  parsingStatus: { isRunning: boolean; currentTaskId: number | null };
  progress?: ParsingProgress;
}> {
  const response = await fetch(`${API_URL}/tasks/${taskId}/status`);
  if (!response.ok) throw new Error('Failed to get task status');
  return response.json();
}

export async function getTaskResults(taskId: number): Promise<CachedUser[]> {
  const response = await fetch(`${API_URL}/tasks/${taskId}/results`);
  if (!response.ok) throw new Error('Failed to get task results');
  return response.json();
}

export async function getUsers(filters: {
  city?: string;
  minFollowers?: number;
  maxFollowers?: number;
  minAge?: number;
}): Promise<CachedUser[]> {
  const params = new URLSearchParams();
  if (filters.city) params.append('city', filters.city);
  if (filters.minFollowers) params.append('minFollowers', filters.minFollowers.toString());
  if (filters.maxFollowers) params.append('maxFollowers', filters.maxFollowers.toString());
  if (filters.minAge) params.append('minAge', filters.minAge.toString());

  const response = await fetch(`${API_URL}/users?${params}`);
  if (!response.ok) throw new Error('Failed to get users');
  return response.json();
}

export async function deleteTask(taskId: number): Promise<void> {
  const response = await fetch(`${API_URL}/tasks/${taskId}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Failed to delete task');
}

export async function saveToken(token: string): Promise<void> {
  const response = await fetch(`${API_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  });
  if (!response.ok) throw new Error('Failed to save token');
}

export async function hasSavedToken(): Promise<boolean> {
  const response = await fetch(`${API_URL}/token`);
  if (!response.ok) throw new Error('Failed to check token');
  const data = await response.json();
  return data.hasToken;
}

export async function validateToken(token: string): Promise<{ valid: boolean; user?: any; error?: string }> {
  const response = await fetch(`${API_URL}/token/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  });
  return response.json();
}

export async function getPreview(
  token: string,
  cityId?: number,
  minAge?: number,
  cityName?: string,
  searchAllCities?: boolean,
  maxAge?: number
): Promise<{ total: number; estimatedTime: number }> {
  const response = await fetch(`${API_URL}/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, cityId, minAge, cityName, searchAllCities, maxAge })
  });
  return response.json();
}
