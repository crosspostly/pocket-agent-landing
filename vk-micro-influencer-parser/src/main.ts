import './style.css';
import {
  getStats,
  getTasks,
  createTask,
  startTask,
  getTaskResults,
  deleteTask,
  saveToken,
  hasSavedToken,
  validateToken,
  getPreview,
  type Task,
  type CachedUser,
  type Stats
} from './api';

class InfluencerParserApp {
  private tasks: Task[] = [];
  private currentResults: CachedUser[] = [];
  private stats: Stats | null = null;

  constructor() {
    this.render();
    this.loadInitialData();
  }

  private render(): void {
    const app = document.querySelector<HTMLDivElement>('#app')!;

    app.innerHTML = `
      <div class="container">
        <div class="app-header">
          <h1>Парсер микроблогеров VK</h1>
          <p class="subtitle">Поиск и анализ аудитории</p>
        </div>

        <div class="tabs-nav">
          <button class="tab-btn active" data-tab="search">🔍 Поиск</button>
          <button class="tab-btn" data-tab="results">📊 Результаты</button>
          <button class="tab-btn" data-tab="settings">⚙️ Настройки</button>
        </div>

        <div class="tab-content active" id="tab-search">
          <div class="panel">
            <h2>🎯 Параметры поиска</h2>
            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label for="cityInput">Город:</label>
                <input type="text" id="cityInput" placeholder="Введите город" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="minAge">Возраст от:</label>
                <input type="number" id="minAge" value="23" min="18" max="100" />
              </div>
              <div class="form-group">
                <label for="maxAge">Возраст до:</label>
                <input type="number" id="maxAge" value="35" min="18" max="100" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="minFollowers">Аудитория от:</label>
                <input type="number" id="minFollowers" value="1000" min="100" />
                <small>Друзья + подписчики</small>
              </div>
              <div class="form-group">
                <label for="maxFollowers">Аудитория до:</label>
                <input type="number" id="maxFollowers" value="10000" min="500" />
                <small>Друзья + подписчики</small>
              </div>
            </div>
            <div class="form-actions">
              <button id="createTaskBtn" class="btn-primary">🚀 Создать и запустить</button>
            </div>
          </div>
          <div class="panel">
            <h2>📋 Задачи</h2>
            <div id="tasksList" class="tasks-list"></div>
          </div>
        </div>

        <div class="tab-content" id="tab-results">
          <div class="panel">
            <div class="results-header">
              <h2>📊 Найденные профили</h2>
              <button id="exportCsvBtn" class="btn-secondary">📥 Экспорт CSV</button>
            </div>
            <div id="resultsCount" class="results-count">0</div>
            <div id="resultsList" class="results-grid"></div>
          </div>
        </div>

        <div class="tab-content" id="tab-settings">
          <div class="panel">
            <h2>⚙️ Настройки</h2>
            <div class="form-group">
              <label for="accessToken">VK Access Token:</label>
              <input type="text" id="accessToken" placeholder="Введите токен" />
              <small>Получите на <a href="https://vk.com/dev" target="_blank">vk.com/dev</a></small>
              <div id="tokenStatus"></div>
            </div>
            <div class="form-actions">
              <button id="validateTokenBtn" class="btn-secondary">✅ Проверить</button>
            </div>
            <div id="validationResult"></div>
          </div>
          <div class="panel">
            <h2>📈 Статистика</h2>
            <div class="stats-panel" id="statsPanel">
              <div class="stat-card">
                <div class="stat-value" id="totalUsers">-</div>
                <div class="stat-label">Пользователей</div>
              </div>
              <div class="stat-card">
                <div class="stat-value" id="totalTasks">-</div>
                <div class="stat-label">Задач</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.setupTabs();
    this.attachEvents();
  }

  private setupTabs(): void {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${tabId}`)?.classList.add('active');
        
        if (tabId === 'results') {
          this.loadResultsTab();
        }
        if (tabId === 'settings') {
          this.loadStats();
        }
      });
    });
  }

  private attachEvents(): void {
    document.getElementById('createTaskBtn')?.addEventListener('click', () => this.createTask());
    document.getElementById('exportCsvBtn')?.addEventListener('click', () => this.exportCSV());
    document.getElementById('validateTokenBtn')?.addEventListener('click', () => this.validateToken());

    const tokenInput = document.getElementById('accessToken') as HTMLInputElement;
    tokenInput?.addEventListener('change', async () => {
      const extracted = this.extractToken(tokenInput.value);
      if (extracted) {
        tokenInput.value = extracted;
        await saveToken(extracted);
        this.checkToken();
      }
    });
  }

  private extractToken(url: string): string | null {
    const hash = url.match(/#.*access_token=([^&]+)/);
    if (hash) return hash[1];
    const query = url.match(/[?&]access_token=([^&]+)/);
    if (query) return query[1];
    if (/^vk1\.a\./.test(url.trim())) return url.trim();
    return null;
  }

  private async loadInitialData(): Promise<void> {
    await Promise.all([this.loadStats(), this.loadTasks(), this.checkToken(), this.loadToken()]);
  }

  private async loadToken(): Promise<void> {
    try {
      const res = await fetch('http://localhost:3001/api/token');
      const data = await res.json();
      if (data.token) {
        (document.getElementById('accessToken') as HTMLInputElement).value = data.token;
      }
    } catch (e) {}
  }

  private async checkToken(): Promise<void> {
    const has = await hasSavedToken();
    const el = document.getElementById('tokenStatus')!;
    el.innerHTML = has ? '<span style="color:green">✅ Сохранён</span>' : '<span style="color:orange">⚠️ Не сохранён</span>';
  }

  private async loadStats(): Promise<void> {
    try {
      this.stats = await getStats();
      if (this.stats) {
        document.getElementById('totalUsers')!.textContent = this.stats.totalUsers.toString();
        document.getElementById('totalTasks')!.textContent = this.stats.totalTasks.toString();
      }
    } catch (e) {}
  }

  private async loadTasks(): Promise<void> {
    try {
      this.tasks = await getTasks();
      const list = document.getElementById('tasksList')!;
      if (this.tasks.length === 0) {
        list.innerHTML = '<p>Нет задач</p>';
        return;
      }
      list.innerHTML = this.tasks.map(t => `
        <div class="task-item">
          <strong>${t.city_name}</strong> ${t.min_age}-${t.max_age || '?'} лет, ${t.min_followers}-${t.max_followers} ауд.
          <span class="status-${t.status}">${t.status} (${t.total_found})</span>
          <button class="btn-results" data-task-id="${t.id}">📊 Результаты</button>
          ${t.status === 'pending' ? `<button class="btn-start" data-task-id="${t.id}">▶️ Запуск</button>` : ''}
        </div>
      `).join('');

      document.querySelectorAll('.btn-results').forEach(btn => {
        btn.addEventListener('click', () => {
          const taskId = +btn.getAttribute('data-task-id')!;
          this.loadResultsForTask(taskId);
        });
      });
      document.querySelectorAll('.btn-start').forEach(btn => {
        btn.addEventListener('click', () => {
          const taskId = +btn.getAttribute('data-task-id')!;
          this.start(taskId);
        });
      });
    } catch (e) {
      console.error('Load tasks error:', e);
    }
  }

  private async createTask(): Promise<void> {
    const city = (document.getElementById('cityInput') as HTMLInputElement).value;
    const minAge = +(document.getElementById('minAge') as HTMLInputElement).value;
    const maxAge = +(document.getElementById('maxAge') as HTMLInputElement).value;
    const minF = +(document.getElementById('minFollowers') as HTMLInputElement).value;
    const maxF = +(document.getElementById('maxFollowers') as HTMLInputElement).value;

    if (!city) { alert('Введите город'); return; }

    try {
      await createTask(undefined, minAge, minF, maxF, city, false, maxAge);
      await this.loadTasks();
      const last = this.tasks[this.tasks.length - 1];
      if (last) await this.start(last.id!);
    } catch (e) {
      alert('Ошибка: ' + e);
    }
  }

  public async start(taskId: number): Promise<void> {
    const token = (document.getElementById('accessToken') as HTMLInputElement).value;
    const acc = this.extractToken(token) || token;
    if (!acc) { alert('Нет токена'); return; }
    try {
      await startTask(taskId, acc);
      alert('Запущено!');
      this.loadTasks();
    } catch (e) {
      alert('Ошибка: ' + e);
    }
  }

  private async loadResultsTab(): Promise<void> {
    // Ищем задачу с результатами
    const taskWithResults = this.tasks.find(t => t.total_found > 0);
    if (taskWithResults) {
      await this.loadResultsForTask(taskWithResults.id!);
    } else {
      document.getElementById('resultsCount')!.textContent = '(0)';
      document.getElementById('resultsList')!.innerHTML = '<p class="empty-state">Нет результатов. Выберите задачу во вкладке "Поиск".</p>';
    }
  }

  private async loadResultsForTask(taskId: number): Promise<void> {
    try {
      const results = await getTaskResults(taskId);
      this.currentResults = results;
      
      const count = document.getElementById('resultsCount')!;
      const list = document.getElementById('resultsList')!;
      count.textContent = `(${results.length})`;

      if (results.length === 0) {
        list.innerHTML = '<p class="empty-state">Нет результатов</p>';
        return;
      }

      list.innerHTML = results.map(u => {
        const total = (u as any).total_audience || u.followers_count;
        const friends = (u as any).friends_count || 0;
        return `
          <div class="user-card">
            <h3><a href="${u.profile_url}" target="_blank">${u.first_name} ${u.last_name}</a></h3>
            <p>👥 Всего: <strong>${total.toLocaleString()}</strong> (друзья: ${friends}, подписчики: ${u.followers_count})</p>
            <p>📍 ${u.city || '?'} | 🎂 ${u.age || '?'} | ${u.sex === 1 ? 'Ж' : 'М'}</p>
            <div class="user-actions">
              <a href="${u.profile_url}" target="_blank" class="btn-small">Профиль</a>
              <button class="btn-small btn-write" data-vk-id="${u.vk_id}">Написать</button>
            </div>
          </div>
        `;
      }).join('');

      // Переключаем на вкладку результатов
      document.querySelector('.tab-btn[data-tab="results"]')?.click();

      // Вешаем обработчики на кнопки "Написать"
      setTimeout(() => {
        document.querySelectorAll('.btn-write').forEach(btn => {
          btn.addEventListener('click', () => {
            const vkId = btn.getAttribute('data-vk-id');
            window.open(`https://vk.com/im?sel=${vkId}`, '_blank');
          });
        });
      }, 100);
    } catch (e) {
      alert('Ошибка загрузки результатов: ' + e);
      console.error(e);
    }
  }

  private async validateToken(): Promise<void> {
    const token = (document.getElementById('accessToken') as HTMLInputElement).value;
    const resDiv = document.getElementById('validationResult')!;
    if (!token) { resDiv.innerHTML = 'Введите токен'; return; }
    try {
      const res = await validateToken(token);
      if (res.valid) {
        resDiv.innerHTML = `✅ ${res.user.first_name} ${res.user.last_name}`;
        await saveToken(token);
        this.checkToken();
      } else {
        resDiv.innerHTML = `❌ ${res.error}`;
      }
    } catch (e) {
      resDiv.innerHTML = 'Ошибка';
    }
  }

  private async exportCSV(): Promise<void> {
    if (this.currentResults.length === 0) { alert('Нет данных'); return; }
    const headers = ['ID', 'Имя', 'Фамилия', 'Подписчики', 'Друзья', 'Всего', 'Город', 'Возраст', 'Профиль'];
    const rows = this.currentResults.map(u => [
      u.vk_id, u.first_name, u.last_name, u.followers_count,
      (u as any).friends_count || 0, (u as any).total_audience || u.followers_count,
      u.city || '', u.age || '', u.profile_url
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `influencers_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }
}

const app = new InfluencerParserApp();
(window as any).app = app;
