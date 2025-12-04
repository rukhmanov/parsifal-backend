import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { EventParticipationRequest } from '../entities/event-participation-request/event-participation-request.entity';
import { User } from '../entities/user/user.entity';
import { Event } from '../entities/event/event.entity';

// Массивы для генерации комментариев
const COMMENTS = [
  'Очень хочу присоединиться!',
  'Буду рад принять участие',
  'Интересное мероприятие, хочу быть частью',
  'С удовольствием присоединюсь',
  'Отличная идея, жду встречи',
  'Хочу провести время в хорошей компании',
  'Звучит интересно, буду рад участвовать',
  'Присоединяюсь с удовольствием',
  'Отличная возможность познакомиться',
  'Буду рад провести время вместе',
  undefined,
  undefined,
  undefined,
  undefined,
  undefined
];

const ITEMS_CAN_BRING_OPTIONS = [
  ['Хорошее настроение'],
  ['Хорошее настроение', 'Вода'],
  ['Хорошее настроение', 'Еда'],
  ['Хорошее настроение', 'Настольная игра'],
  ['Хорошее настроение', 'Музыка'],
  ['Хорошее настроение', 'Фотоаппарат'],
  undefined,
  undefined,
  undefined
];

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generateRandomRequest(eventId: string, userId: string): Partial<EventParticipationRequest> {
  const comment = getRandomElement(COMMENTS);
  const itemsCanBring = getRandomElement(ITEMS_CAN_BRING_OPTIONS);
  const canBringMoney = Math.random() > 0.5 ? Math.random() > 0.3 : undefined;
  
  // Случайные значения для соответствия требованиям
  const ageMatches = Math.random() > 0.6 ? Math.random() > 0.2 : undefined;
  const genderMatches = Math.random() > 0.6 ? Math.random() > 0.2 : undefined;
  
  // meetsRequirements будет true, если оба условия выполнены или не заданы
  const meetsRequirements = (ageMatches === undefined || ageMatches) && 
                           (genderMatches === undefined || genderMatches);

  return {
    eventId,
    userId,
    status: 'pending',
    type: 'application',
    ageMatches,
    genderMatches,
    itemsCanBring,
    canBringMoney,
    meetsRequirements,
    comment
  };
}

async function createBulkParticipationRequests(eventId: string, count: number = 200) {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  // Получаем DataSource для доступа к репозиториям
  const dataSource = app.get(DataSource);
  const requestRepo = dataSource.getRepository(EventParticipationRequest);
  const userRepo = dataSource.getRepository(User);
  const eventRepo = dataSource.getRepository(Event);

  try {
    console.log(`Создание ${count} заявок на участие в событии ${eventId}...`);
    
    // Проверяем, что событие существует
    const event = await eventRepo.findOne({ 
      where: { id: eventId },
      relations: ['participants', 'creator']
    });
    
    if (!event) {
      console.error(`Событие с ID ${eventId} не найдено`);
      return;
    }
    
    console.log(`Событие найдено: "${event.title}"`);
    console.log(`Создатель: ${event.creator?.displayName || event.creatorId}`);
    
    // Получаем всех пользователей, исключая создателя события и уже участвующих
    const allUsers = await userRepo.find({ select: ['id'] });
    const excludedUserIds = new Set([
      event.creatorId,
      ...(event.participants || []).map(p => p.id)
    ]);
    
    // Получаем существующие заявки для этого события
    const existingRequests = await requestRepo.find({
      where: { eventId },
      select: ['userId']
    });
    const existingUserIds = new Set(existingRequests.map(r => r.userId));
    
    // Фильтруем пользователей
    const availableUsers = allUsers.filter(
      user => !excludedUserIds.has(user.id) && !existingUserIds.has(user.id)
    );
    
    if (availableUsers.length === 0) {
      console.error('Нет доступных пользователей для создания заявок');
      return;
    }
    
    if (availableUsers.length < count) {
      console.warn(`Доступно только ${availableUsers.length} пользователей, будет создано ${availableUsers.length} заявок`);
      count = availableUsers.length;
    }
    
    console.log(`Доступно пользователей: ${availableUsers.length}`);
    console.log(`Будет создано заявок: ${count}`);
    
    const startTime = Date.now();
    let createdCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Перемешиваем пользователей случайным образом
    const shuffledUsers = [...availableUsers].sort(() => Math.random() - 0.5);
    const selectedUsers = shuffledUsers.slice(0, count);

    // Создаем заявки батчами
    const BATCH_SIZE = 50;
    for (let i = 0; i < selectedUsers.length; i += BATCH_SIZE) {
      const batch = selectedUsers.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(selectedUsers.length / BATCH_SIZE);

      console.log(`Обработка батча ${batchNumber}/${totalBatches} (${batch.length} заявок)...`);

      // Создаем заявки в батче
      const batchPromises = batch.map(async (user) => {
        try {
          // Проверяем, не создана ли уже заявка (на случай параллельного выполнения)
          const existing = await requestRepo.findOne({
            where: { eventId, userId: user.id }
          });
          
          if (existing) {
            skippedCount++;
            return null;
          }

          const requestData = generateRandomRequest(eventId, user.id);
          const request = requestRepo.create(requestData);
          await requestRepo.save(request);
          createdCount++;
          return request.id;
        } catch (error) {
          // Проверяем, не дубликат ли это (уникальный индекс)
          if (error instanceof Error && error.message.includes('duplicate') || 
              error instanceof Error && error.message.includes('unique')) {
            skippedCount++;
            return null;
          }
          errorCount++;
          console.error(`Ошибка при создании заявки для пользователя ${user.id}:`, error instanceof Error ? error.message : error);
          return null;
        }
      });

      await Promise.all(batchPromises);

      // Показываем прогресс
      const progress = ((i + batch.length) / count * 100).toFixed(1);
      console.log(`Прогресс: ${progress}% (Создано: ${createdCount}, Пропущено: ${skippedCount}, Ошибок: ${errorCount})`);
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`\n=== Результат ===`);
    console.log(`- Создано заявок: ${createdCount}`);
    console.log(`- Пропущено (уже существуют): ${skippedCount}`);
    console.log(`- Ошибок: ${errorCount}`);
    console.log(`- Всего обработано: ${count}`);
    console.log(`- Время выполнения: ${duration} секунд`);
    console.log(`- Средняя скорость: ${(createdCount / parseFloat(duration)).toFixed(2)} заявок/сек`);

    // Статистика по статусам
    const requestsByStatus = await requestRepo
      .createQueryBuilder('request')
      .select('request.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('request.eventId = :eventId', { eventId })
      .groupBy('request.status')
      .getRawMany();
    
    console.log(`\n=== Статистика по статусам ===`);
    requestsByStatus.forEach((item: any) => {
      console.log(`- ${item.status}: ${item.count}`);
    });

  } catch (error) {
    console.error('Критическая ошибка при создании заявок:', error);
  } finally {
    await app.close();
  }
}

// Запуск скрипта
if (require.main === module) {
  const eventId = process.argv[2];
  const count = process.argv[3] ? parseInt(process.argv[3], 10) : 200;
  
  if (!eventId) {
    console.error('Использование: npm run create-bulk-participation-requests <eventId> [count]');
    console.error('Пример: npm run create-bulk-participation-requests 808a445a-f896-40dd-9450-6b45d5feeca2 200');
    process.exit(1);
  }
  
  if (isNaN(count) || count <= 0) {
    console.error('Неверное количество заявок. Используется значение по умолчанию: 200');
    createBulkParticipationRequests(eventId, 200);
  } else {
    createBulkParticipationRequests(eventId, count);
  }
}


