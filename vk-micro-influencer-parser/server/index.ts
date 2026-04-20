import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from 'dotenv';
import { db } from './database';
import { VKParserService, createParsingTask } from './vkService';
import { messageRandomizer, MessageTemplate } from './messageTemplates';
import { VKApiClient } from './vkApi';
import { CITIES } from './types';
import {
  analyzeUserInterests,
  filterByInterests,
  searchByKeywords,
  rankForBarter,
  getTopCategories,
  INTEREST_CATEGORIES,
  type AnalyzedUser
} from './interestAnalyzer';

// Загружаем .env
config();

// Функция для сохранения токена в .env
function saveTokenToEnv(token: string): void {
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
    // Заменяем существующий токен
    if (envContent.includes('VK_ACCESS_TOKEN=')) {
      envContent = envContent.replace(/VK_ACCESS_TOKEN=.*/g, `VK_ACCESS_TOKEN=${token}`);
    } else {
      envContent += `\nVK_ACCESS_TOKEN=${token}\n`;
    }
  } else {
    envContent = `# VK API Access Token\nVK_ACCESS_TOKEN=${token}\n`;
  }
  
  fs.writeFileSync(envPath, envContent);
  // Обновляем process.env
  process.env.VK_ACCESS_TOKEN = token;
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

let parserService: VKParserService | null = null;

app.use(express.static(path.join(__dirname, '../dist')));

app.get('/api/stats', async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await db.getAllTasks();
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get tasks' });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const { cityId, cityName, searchAllCities, minAge, maxAge, minFollowers, maxFollowers } = req.body;

    console.log('📥 Создание задачи:', req.body);

    // Определяем название для отображения
    let cityNameDisplay = '';
    if (searchAllCities) {
      cityNameDisplay = 'Все города';
    } else if (cityName) {
      cityNameDisplay = cityName;
    } else {
      // Поиск по ID города (старый формат)
      const city = Object.values(CITIES).find(c => c.id === cityId);
      cityNameDisplay = city?.name || 'Неизвестно';
    }

    const taskId = await db.createTask({
      city_id: cityId,
      city_name: cityNameDisplay,
      city_name_input: cityName || null,
      search_all_cities: searchAllCities || false,
      min_age: minAge || 23,
      max_age: maxAge || null,
      min_followers: minFollowers || 1000,
      max_followers: maxFollowers || 10000,
      status: 'pending',
      total_found: 0
    });

    console.log('✅ Задача создана:', taskId);
    res.json({ taskId, message: 'Task created successfully' });
  } catch (error: any) {
    console.error('❌ Ошибка создания задачи:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Failed to create task', details: error.message });
  }
});

app.post('/api/tasks/:taskId/start', async (req, res) => {
  try {
    const { taskId } = req.params;
    let { accessToken } = req.body;

    console.log('📥 Получен токен от клиента:', accessToken ? accessToken.substring(0, 30) + '...' : 'НЕТ ТОКЕНА');
    console.log('📥 Длина токена:', accessToken?.length);

    // Если токен не передан, пробуем взять из .env
    if (!accessToken) {
      accessToken = process.env.VK_ACCESS_TOKEN;
    }

    if (!accessToken) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    // Сохраняем токен в .env для будущих запусков
    saveTokenToEnv(accessToken);

    parserService = new VKParserService(accessToken);

    parserService.startParsing(parseInt(taskId)).catch(error => {
      console.error('Parsing error:', error);
    });

    res.json({ message: 'Parsing started', saved: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start parsing' });
  }
});

// API для сохранения токена
app.post('/api/token', (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }
    
    saveTokenToEnv(token);
    res.json({ message: 'Token saved to .env' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save token' });
  }
});

// API для получения сохраненного токена
app.get('/api/token', (req, res) => {
  const token = process.env.VK_ACCESS_TOKEN || '';
  res.json({ hasToken: !!token, token });
});

// API для проверки токена
app.post('/api/token/validate', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    const client = new VKApiClient(token);
    const result = await client.validateToken();
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Validation failed' });
  }
});

// API для предпросмотра результатов
app.post('/api/preview', async (req, res) => {
  try {
    const { token, cityId, cityName, searchAllCities, minAge, maxAge } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    const client = new VKApiClient(token);

    // Если поиск по всем городам, не передаём city
    const estimate = await client.getEstimatedResults(
      searchAllCities ? undefined : cityId,
      minAge,
      searchAllCities ? undefined : cityName,
      maxAge
    );

    res.json(estimate);
  } catch (error) {
    res.status(500).json({ error: 'Preview failed' });
  }
});

// API для анализа интересов
app.get('/api/interests/categories', (req, res) => {
  res.json(Object.keys(INTEREST_CATEGORIES));
});

app.post('/api/users/:taskId/analyze', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { categories, keywords, minConfidence } = req.body;
    
    const users = await db.getUsersByTask(parseInt(taskId));
    
    // Фильтруем по ключевым словам если есть
    let filtered = users;
    if (keywords && keywords.length > 0) {
      filtered = searchByKeywords(users, keywords);
    }
    
    // Анализируем интересы
    const analyzed = filterByInterests(filtered, categories, minConfidence || 1);
    
    // Ранжируем для бартера
    const ranked = rankForBarter(analyzed);
    
    // Получаем топ категории
    const topCategories = getTopCategories(ranked, 10);
    
    res.json({
      total: ranked.length,
      topCategories,
      users: ranked.slice(0, 100) // Отдаем первые 100
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to analyze users' });
  }
});

// API для поиска по ключевым словам
app.post('/api/users/search', async (req, res) => {
  try {
    const { keywords, city, minFollowers, maxFollowers } = req.body;
    
    const filters: any = {};
    if (city) filters.city = city;
    if (minFollowers) filters.minFollowers = minFollowers;
    if (maxFollowers) filters.maxFollowers = maxFollowers;
    
    const users = await db.getUsersByFilters(filters);
    const matched = searchByKeywords(users, keywords);
    
    res.json(matched);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search users' });
  }
});

app.get('/api/tasks/:taskId/status', async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await db.getTask(parseInt(taskId));
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const parsingStatus = parserService ? await parserService.getParsingStatus() : { isRunning: false, currentTaskId: null };
    const progress = parserService?.getProgress();
    
    res.json({
      task,
      parsingStatus,
      progress
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get task status' });
  }
});

app.get('/api/tasks/:taskId/results', async (req, res) => {
  try {
    const { taskId } = req.params;
    const users = await db.getUsersByTask(parseInt(taskId));
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get results' });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const { city, minFollowers, maxFollowers, minAge, maxAge } = req.query;

    const filters: any = {};
    if (city) filters.city = city as string;
    if (minFollowers) filters.minFollowers = parseInt(minFollowers as string);
    if (maxFollowers) filters.maxFollowers = parseInt(maxFollowers as string);
    if (minAge) filters.minAge = parseInt(minAge as string);
    if (maxAge) filters.maxAge = parseInt(maxAge as string);

    const users = await db.getUsersByFilters(filters);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get users' });
  }
});

app.delete('/api/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    await db.deleteTask(parseInt(taskId));
    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// API для шаблонов сообщений
app.get('/api/templates', (req, res) => {
  try {
    const templates = messageRandomizer.getTemplates();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get templates' });
  }
});

app.post('/api/templates/:templateId/generate', (req, res) => {
  try {
    const { templateId } = req.params;
    const { variables, useAI, tone, variantCount } = req.body;
    
    if (useAI) {
      const message = messageRandomizer.generateAIVariant(templateId, variables || {}, tone || 'friendly');
      res.json({ messages: [message] });
    } else if (variantCount && variantCount > 1) {
      const messages = messageRandomizer.generateVariants(templateId, variables || {}, variantCount);
      res.json({ messages });
    } else {
      const message = messageRandomizer.randomize(templateId, variables || {});
      res.json({ messages: [message] });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate message' });
  }
});

app.post('/api/templates', (req, res) => {
  try {
    const template: MessageTemplate = req.body;
    messageRandomizer.addTemplate(template);
    res.json({ message: 'Template added' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add template' });
  }
});

// API для отправки сообщений (через VK API)
app.post('/api/messages/send', async (req, res) => {
  try {
    const { userId, message, accessToken } = req.body;
    
    if (!accessToken) {
      return res.status(400).json({ error: 'Access token required' });
    }

    // Здесь будет вызов VK API для отправки сообщения
    // Требуется scope: messages
    res.json({ 
      message: 'Message sending not implemented - requires messages permission',
      note: 'To send messages, you need: 1) User token with "messages" scope, 2) User must allow messages from community'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

async function startServer() {
  await db.init();
  console.log('Database initialized');
  
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
