import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { Event } from '../entities/event/event.entity';
import { User } from '../entities/user/user.entity';

// Массивы для генерации реалистичных событий
const EVENT_TITLES = [
  'Попить кофе', 'Сходить в кино', 'Прогулка в парке', 'Игра в настольные игры',
  'Поход в театр', 'Встреча в кафе', 'Спортивная тренировка', 'Велосипедная прогулка',
  'Пикник на природе', 'Концерт', 'Выставка', 'Мастер-класс по кулинарии',
  'Йога в парке', 'Фотосессия', 'Настольный теннис', 'Боулинг',
  'Караоке', 'Настольные игры', 'Винная дегустация', 'Кулинарный мастер-класс',
  'Танцевальный вечер', 'Квест', 'Экскурсия', 'Поход в музей',
  'Плавание в бассейне', 'Бег в парке', 'Встреча для обсуждения книг', 'Игра в футбол',
  'Волейбол на пляже', 'Пицца-вечеринка', 'Барбекю', 'Поход в зоопарк',
  'Катание на коньках', 'Лыжная прогулка', 'Рыбалка', 'Поход в горы'
];

const EVENT_DESCRIPTIONS = [
  'Приглашаю всех желающих провести время вместе!',
  'Будет интересно и весело, присоединяйтесь!',
  'Отличная возможность познакомиться с новыми людьми.',
  'Жду всех, кто хочет хорошо провести время.',
  'Мероприятие для активных и позитивных людей.',
  'Приходите, будет здорово!',
  'Отличный способ провести выходной день.',
  'Приглашаю всех желающих!',
  'Будем рады видеть вас!',
  'Интересное мероприятие для всех.'
];

const ITEMS_TO_BRING_OPTIONS = [
  ['Хорошее настроение'],
  ['Хорошее настроение', 'Вода'],
  ['Хорошее настроение', 'Полотенце'],
  ['Хорошее настроение', 'Спортивная форма'],
  ['Хорошее настроение', 'Книга'],
  ['Хорошее настроение', 'Настольная игра'],
  ['Хорошее настроение', 'Фотоаппарат'],
  ['Хорошее настроение', 'Еда для пикника'],
  ['Хорошее настроение', 'Напитки']
];

const ADDRESSES = [
  'Москва, Красная площадь, 1',
  'Санкт-Петербург, Невский проспект, 28',
  'Москва, Парк Горького',
  'Санкт-Петербург, Летний сад',
  'Москва, ВДНХ',
  'Санкт-Петербург, Петропавловская крепость',
  'Москва, Парк Сокольники',
  'Санкт-Петербург, Новая Голландия',
  'Москва, ЦПКиО им. Горького',
  'Санкт-Петербург, Елагин остров'
];

const ADDRESS_COMMENTS = [
  'Встречаемся у главного входа',
  'Парковка рядом',
  'Удобный подъезд',
  'Рядом с метро',
  'Вход со двора',
  'Здание справа',
  'Первый этаж',
  null,
  null,
  null
];

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomDateInFuture(daysFromNow: number = 1, maxDays: number = 90): Date {
  const now = new Date();
  const days = daysFromNow + Math.floor(Math.random() * maxDays);
  const hours = Math.floor(Math.random() * 24);
  const minutes = Math.floor(Math.random() * 60);
  
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  date.setHours(hours, minutes, 0, 0);
  
  return date;
}

function getRandomDateInPast(daysAgo: number = 1, maxDays: number = 180): Date {
  const now = new Date();
  const days = daysAgo + Math.floor(Math.random() * maxDays);
  const hours = Math.floor(Math.random() * 24);
  const minutes = Math.floor(Math.random() * 60);
  
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  date.setHours(hours, minutes, 0, 0);
  
  return date;
}

function generateRandomEvent(creatorId: string): Partial<Event> {
  const title = getRandomElement(EVENT_TITLES);
  const description = Math.random() > 0.3 ? getRandomElement(EVENT_DESCRIPTIONS) : undefined;
  
  // 70% будущих событий, 30% прошедших
  const isFuture = Math.random() > 0.3;
  const dateTime = isFuture 
    ? getRandomDateInFuture(1, 90)
    : getRandomDateInPast(1, 180);
  
  const itemsToBring = Math.random() > 0.5 ? getRandomElement(ITEMS_TO_BRING_OPTIONS) : undefined;
  const moneyRequired = Math.random() > 0.6 ? Math.floor(Math.random() * 5000) + 100 : undefined;
  
  // Геолокация (примерно для 60% событий)
  const hasLocation = Math.random() > 0.4;
  const latitude = hasLocation ? 55.7558 + (Math.random() - 0.5) * 0.1 : undefined; // Примерно Москва
  const longitude = hasLocation ? 37.6173 + (Math.random() - 0.5) * 0.1 : undefined;
  
  const address = Math.random() > 0.3 ? getRandomElement(ADDRESSES) : undefined;
  const addressCommentRaw = address && Math.random() > 0.5 ? getRandomElement(ADDRESS_COMMENTS) : undefined;
  const addressComment = addressCommentRaw || undefined;
  
  const entrance = Math.random() > 0.7 ? Math.floor(Math.random() * 5) + 1 : undefined;
  const floor = Math.random() > 0.7 ? Math.floor(Math.random() * 20) + 1 : undefined;
  const apartment = Math.random() > 0.7 ? Math.floor(Math.random() * 200) + 1 : undefined;
  
  const maxParticipants = Math.random() > 0.4 
    ? Math.floor(Math.random() * 20) + 2 
    : undefined;
  
  const minAge = Math.random() > 0.7 ? Math.floor(Math.random() * 10) + 18 : undefined;
  const maxAge = minAge ? minAge + Math.floor(Math.random() * 30) + 5 : undefined;
  
  const preferredGender: 'male' | 'female' | 'any' | undefined = Math.random() > 0.7 
    ? getRandomElement(['male', 'female', 'any'] as const)
    : undefined;
  
  const duration = Math.random() > 0.5 
    ? Math.floor(Math.random() * 240) + 30 // От 30 минут до 4.5 часов
    : undefined;

  return {
    title,
    description,
    dateTime,
    itemsToBring,
    moneyRequired,
    latitude,
    longitude,
    address,
    addressComment,
    entrance: entrance ?? 1,
    floor: floor ?? 1,
    apartment: apartment ?? 1,
    maxParticipants,
    minAge,
    maxAge,
    preferredGender,
    duration,
    creatorId
  };
}

async function createBulkEvents(count: number = 3000) {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  // Получаем DataSource для доступа к репозиториям
  const dataSource = app.get(DataSource);
  const eventRepo = dataSource.getRepository(Event);
  const userRepo = dataSource.getRepository(User);

  try {
    console.log(`Начинаем создание ${count} событий...`);
    
    // Получаем всех пользователей
    console.log('Загрузка пользователей из базы данных...');
    const users = await userRepo.find({ select: ['id'] });
    
    if (users.length === 0) {
      console.error('В базе данных нет пользователей. Сначала создайте пользователей.');
      return;
    }
    
    console.log(`Найдено ${users.length} пользователей`);
    const startTime = Date.now();

    const BATCH_SIZE = 100; // Размер батча для оптимизации
    let createdCount = 0;
    let errorCount = 0;

    // Генерируем все события заранее
    const eventsToCreate: Array<{ eventData: Partial<Event>; creatorId: string }> = [];
    for (let i = 0; i < count; i++) {
      // Случайный пользователь
      const randomUser = getRandomElement(users);
      const eventData = generateRandomEvent(randomUser.id);
      eventsToCreate.push({ eventData, creatorId: randomUser.id });
    }

    // Обрабатываем батчами
    for (let i = 0; i < eventsToCreate.length; i += BATCH_SIZE) {
      const batch = eventsToCreate.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(eventsToCreate.length / BATCH_SIZE);

      console.log(`Обработка батча ${batchNumber}/${totalBatches} (${batch.length} событий)...`);

      // Создаем события в батче
      const batchPromises = batch.map(async ({ eventData }) => {
        try {
          const event = eventRepo.create(eventData);
          await eventRepo.save(event);
          createdCount++;
          return event.id;
        } catch (error) {
          errorCount++;
          console.error(`Ошибка при создании события "${eventData.title}":`, error instanceof Error ? error.message : error);
          return null;
        }
      });

      await Promise.all(batchPromises);

      // Показываем прогресс
      const progress = ((i + batch.length) / count * 100).toFixed(1);
      console.log(`Прогресс: ${progress}% (Создано: ${createdCount}, Ошибок: ${errorCount})`);
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`\n=== Результат ===`);
    console.log(`- Создано событий: ${createdCount}`);
    console.log(`- Ошибок: ${errorCount}`);
    console.log(`- Всего обработано: ${count}`);
    console.log(`- Время выполнения: ${duration} секунд`);
    console.log(`- Средняя скорость: ${(createdCount / parseFloat(duration)).toFixed(2)} событий/сек`);

    // Статистика по пользователям
    const eventsByUser = await eventRepo
      .createQueryBuilder('event')
      .select('event.creatorId', 'creatorId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('event.creatorId')
      .getRawMany();
    
    console.log(`\n=== Статистика ===`);
    console.log(`- Пользователей с событиями: ${eventsByUser.length}`);
    const maxEvents = Math.max(...eventsByUser.map((e: any) => parseInt(e.count)));
    const minEvents = Math.min(...eventsByUser.map((e: any) => parseInt(e.count)));
    const avgEvents = (eventsByUser.reduce((sum: number, e: any) => sum + parseInt(e.count), 0) / eventsByUser.length).toFixed(1);
    console.log(`- Максимум событий у одного пользователя: ${maxEvents}`);
    console.log(`- Минимум событий у одного пользователя: ${minEvents}`);
    console.log(`- Среднее количество событий на пользователя: ${avgEvents}`);

  } catch (error) {
    console.error('Критическая ошибка при создании событий:', error);
  } finally {
    await app.close();
  }
}

// Запуск скрипта
if (require.main === module) {
  const count = process.argv[2] ? parseInt(process.argv[2], 10) : 3000;
  if (isNaN(count) || count <= 0) {
    console.error('Неверное количество событий. Используется значение по умолчанию: 3000');
    createBulkEvents(3000);
  } else {
    createBulkEvents(count);
  }
}

