export interface MessageTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
}

export interface RandomizedMessage {
  subject: string;
  body: string;
}

// Шаблоны для бартерного сотрудничества
export const defaultTemplates: MessageTemplate[] = [
  {
    id: 'barter_1',
    name: 'Бартер - Продукт',
    subject: 'Предложение сотрудничества',
    body: `Привет, {first_name}! 👋

Меня зовут {sender_name}, я представляю бренд {brand_name}.

Ваш профиль в ВК нам очень понравился - особенно ваша аудитория и стиль контента! 🎯

Хотим предложить вам бартерное сотрудничество:
• Мы предоставляем {product_name}
• Вы делаете {content_type} (пост/сторис/обзор)
• Взаимный пиар и развитие

Что думаете? Можем обсудить детали в личных сообщениях.

С уважением,
{sender_name}`,
    variables: ['first_name', 'sender_name', 'brand_name', 'product_name', 'content_type']
  },
  {
    id: 'barter_2',
    name: 'Бартер - Услуга',
    subject: 'Collaboration proposal',
    body: `Здравствуйте, {first_name}!

Нашли ваш профиль через поиск блогеров в {city}. Впечатлены вашим контентом!

Предлагаем сотрудничество:
🔹 Наша услуга: {service_name}
🔹 Ваш формат: {content_type}
🔹 Условия: бартер

Это выгодно для обеих сторон - вы получаете качественный продукт, мы - честный отзыв.

Готовы обсудить?

{sender_name}
{brand_name}`,
    variables: ['first_name', 'city', 'service_name', 'content_type', 'sender_name', 'brand_name']
  },
  {
    id: 'barter_3',
    name: 'Бартер - Короткий',
    subject: 'Collab?',
    body: `Привет {first_name}! 

{brand_name} ищет блогеров для бартера. 

Наше предложение: {product_name} в обмен на {content_type}.

Интересно? Напишите "+" в ответ.`,
    variables: ['first_name', 'brand_name', 'product_name', 'content_type']
  }
];

// Синонимы для рандомизации
const synonyms: Record<string, string[]> = {
  'Привет': ['Привет', 'Здравствуй', 'Приветствую', 'Хай', 'Добрый день'],
  'понравился': ['понравился', 'впечатлил', 'зацепил', 'приглянулся', 'вызвал интерес'],
  'предлагаем': ['предлагаем', 'предлагаю', 'хотим предложить', 'готовы предложить'],
  'сотрудничество': ['сотрудничество', 'коллаборацию', 'партнерство', 'взаимовыгодное сотрудничество'],
  'обсудить': ['обсудить', 'поговорить', 'пообщаться', 'выяснить детали'],
  'интересно': ['интересно', 'актуально', 'привлекательно', 'выгодно'],
  'что думаете': ['что думаете', 'как вам', 'ваше мнение', 'что скажете'],
};

// Вариации эмодзи
const emojiVariations: Record<string, string[]> = {
  greeting: ['👋', '✌️', '🙌', '👋🏻', ''],
  fire: ['🔥', '⚡', '💥', '✨', '🌟'],
  target: ['🎯', '🎪', '🎨', '🎬', '📸'],
  product: ['🎁', '📦', '💎', '✨', '🛍️'],
  question: ['❓', '🤔', '💭', '❔', ''],
};

export class MessageRandomizer {
  private templates: MessageTemplate[];

  constructor(templates: MessageTemplate[] = defaultTemplates) {
    this.templates = templates;
  }

  /**
   * Рандомизирует сообщение по шаблону
   */
  randomize(templateId: string, variables: Record<string, string>): RandomizedMessage {
    const template = this.templates.find(t => t.id === templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    let subject = this.replaceVariables(template.subject, variables);
    let body = this.replaceVariables(template.body, variables);

    // Применяем рандомизацию синонимов
    body = this.applySynonymRandomization(body);
    
    // Применяем рандомизацию эмодзи
    body = this.applyEmojiRandomization(body);

    // Добавляем случайные вариации
    body = this.addVariations(body);

    return { subject, body };
  }

  /**
   * Генерирует ИИ-вариант сообщения на основе шаблона
   */
  generateAIVariant(templateId: string, variables: Record<string, string>, tone: 'friendly' | 'professional' | 'casual' = 'friendly'): RandomizedMessage {
    const base = this.randomize(templateId, variables);
    
    const toneModifiers: Record<string, string> = {
      friendly: 'теплый, дружелюбный тон с эмодзи',
      professional: 'деловой, профессиональный тон',
      casual: 'неформальный, разговорный тон'
    };

    // Добавляем пометку для ИИ
    const aiPrompt = `
[ИИ-ГЕНЕРАЦИЯ]
Тон: ${toneModifiers[tone]}
Переменные: ${JSON.stringify(variables)}

Исходное сообщение:
${base.body}

Инструкция: Сохрани смысл, но перепиши текст в указанном тоне. Добавь естественности и персонализации.
`;

    // В реальности здесь был бы вызов ИИ API
    // Пока возвращаем рандомизированную версию с пометкой
    return {
      subject: base.subject,
      body: `[AI-${tone.toUpperCase()}]\n${base.body}\n\n---\nДля полной ИИ-генерации подключите API (OpenAI/Anthropic)`
    };
  }

  /**
   * Генерирует несколько вариантов сообщения
   */
  generateVariants(templateId: string, variables: Record<string, string>, count: number = 3): RandomizedMessage[] {
    const variants: RandomizedMessage[] = [];
    
    for (let i = 0; i < count; i++) {
      variants.push(this.randomize(templateId, variables));
    }

    return variants;
  }

  private replaceVariables(text: string, variables: Record<string, string>): string {
    let result = text;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{${key}}`, 'g'), value);
    }
    return result;
  }

  private applySynonymRandomization(text: string): string {
    let result = text;
    
    for (const [word, alternatives] of Object.entries(synonyms)) {
      if (result.includes(word)) {
        const randomSynonym = alternatives[Math.floor(Math.random() * alternatives.length)];
        // Заменяем только первое вхождение для естественности
        result = result.replace(word, randomSynonym);
      }
    }
    
    return result;
  }

  private applyEmojiRandomization(text: string): string {
    let result = text;
    
    // Заменяем маркеры эмодзи на случайные варианты
    for (const [category, emojis] of Object.entries(emojiVariations)) {
      const marker = `[${category.toUpperCase()}]`;
      if (result.includes(marker)) {
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        result = result.replace(marker, randomEmoji);
      }
    }
    
    return result;
  }

  private addVariations(text: string): string {
    // Случайно добавляем или убираем эмодзи в конце предложений
    const sentences = text.split(/(?<=[.!?])\s+/);
    
    return sentences.map(sentence => {
      if (Math.random() > 0.7 && !sentence.match(/[\u{1F300}-\u{1F9FF}]/u)) {
        // 30% шанс добавить эмодзи в конец
        const randomEmoji = emojiVariations.fire[Math.floor(Math.random() * emojiVariations.fire.length)];
        return sentence.trim() + ' ' + randomEmoji;
      }
      return sentence;
    }).join(' ');
  }

  getTemplates(): MessageTemplate[] {
    return this.templates;
  }

  addTemplate(template: MessageTemplate): void {
    this.templates.push(template);
  }
}

// Экспортируем singleton
export const messageRandomizer = new MessageRandomizer();
