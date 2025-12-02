import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UserService } from '../entities/user/user.service';
import { DataSource } from 'typeorm';
import { Friend } from '../entities/friend/friend.entity';
import { User } from '../entities/user/user.entity';

async function addFriendsToUser(userId: string, count: number = 1500) {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const userService = app.get(UserService);
  
  // Получаем DataSource для доступа к репозиториям
  const dataSource = app.get(DataSource);
  const friendRepository = dataSource.getRepository(Friend);
  const userRepository = dataSource.getRepository(User);

  try {
    console.log(`Начинаем добавление ${count} друзей для пользователя ${userId}...`);
    const startTime = Date.now();

    // Проверяем, существует ли пользователь
    const user = await userService.findById(userId);
    if (!user) {
      throw new Error(`Пользователь с ID ${userId} не найден`);
    }

    console.log(`Пользователь найден: ${user.displayName} (${user.email})`);

    // Получаем список существующих друзей
    const existingFriends = await friendRepository.find({
      where: { userId },
      select: ['friendId']
    });
    const existingFriendIds = new Set(existingFriends.map(f => f.friendId));
    console.log(`У пользователя уже есть ${existingFriendIds.size} друзей`);

    // Получаем всех пользователей, исключая самого пользователя и его друзей
    const allUsers = await userRepository.find({
      select: ['id'],
      where: {
        isActive: true
      }
    });

    // Фильтруем пользователей: исключаем самого пользователя и существующих друзей
    const availableUsers = allUsers
      .filter(u => u.id !== userId && !existingFriendIds.has(u.id))
      .map(u => u.id);

    console.log(`Доступно пользователей для добавления: ${availableUsers.length}`);

    if (availableUsers.length < count) {
      console.warn(`⚠️  Внимание: доступно только ${availableUsers.length} пользователей, но требуется ${count}`);
      console.log(`Будет добавлено ${availableUsers.length} друзей`);
    }

    const usersToAdd = availableUsers.slice(0, count);
    const actualCount = usersToAdd.length;

    if (actualCount === 0) {
      console.log('Нет доступных пользователей для добавления в друзья');
      return;
    }

    console.log(`Добавляем ${actualCount} друзей...`);

    // Создаем друзей батчами для оптимизации
    const BATCH_SIZE = 100;
    let addedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < usersToAdd.length; i += BATCH_SIZE) {
      const batch = usersToAdd.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(usersToAdd.length / BATCH_SIZE);

      console.log(`Обработка батча ${batchNumber}/${totalBatches} (${batch.length} друзей)...`);

      // Создаем двусторонние записи о дружбе
      const friendsToCreate: Friend[] = [];
      
      for (const friendId of batch) {
        // Проверяем, не существует ли уже такая дружба
        const existing = await friendRepository.findOne({
          where: [
            { userId, friendId },
            { userId: friendId, friendId: userId }
          ]
        });

        if (!existing) {
          // Создаем две записи (взаимная дружба)
          const friend1 = friendRepository.create({
            userId,
            friendId
          });
          const friend2 = friendRepository.create({
            userId: friendId,
            friendId: userId
          });
          friendsToCreate.push(friend1, friend2);
        }
      }

      if (friendsToCreate.length > 0) {
        try {
          await friendRepository.save(friendsToCreate);
          addedCount += friendsToCreate.length / 2; // Делим на 2, так как создаем 2 записи на друга
        } catch (error) {
          errorCount++;
          console.error(`Ошибка при сохранении батча ${batchNumber}:`, error instanceof Error ? error.message : error);
        }
      }

      // Показываем прогресс
      const progress = ((i + batch.length) / actualCount * 100).toFixed(1);
      console.log(`Прогресс: ${progress}% (Добавлено: ${addedCount}, Ошибок: ${errorCount})`);
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`\n=== Результат ===`);
    console.log(`- Добавлено друзей: ${addedCount}`);
    console.log(`- Ошибок: ${errorCount}`);
    console.log(`- Время выполнения: ${duration} секунд`);
    console.log(`- Средняя скорость: ${(addedCount / parseFloat(duration)).toFixed(2)} друзей/сек`);

  } catch (error) {
    console.error('Критическая ошибка при добавлении друзей:', error);
    throw error;
  } finally {
    await app.close();
  }
}

// Запуск скрипта
if (require.main === module) {
  const userId = process.argv[2];
  const count = process.argv[3] ? parseInt(process.argv[3], 10) : 1500;

  if (!userId) {
    console.error('Ошибка: необходимо указать ID пользователя');
    console.log('Использование: ts-node src/scripts/add-friends.ts <userId> [count]');
    process.exit(1);
  }

  if (isNaN(count) || count <= 0) {
    console.error('Неверное количество друзей. Используется значение по умолчанию: 1500');
    addFriendsToUser(userId, 1500);
  } else {
    addFriendsToUser(userId, count);
  }
}

