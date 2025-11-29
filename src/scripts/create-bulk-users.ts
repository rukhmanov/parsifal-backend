import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UserService } from '../entities/user/user.service';
import * as bcrypt from 'bcrypt';

// Массивы русских имен и фамилий для генерации
const FIRST_NAMES = [
  'Александр', 'Дмитрий', 'Максим', 'Сергей', 'Андрей', 'Алексей', 'Артем', 'Илья', 'Кирилл', 'Михаил',
  'Никита', 'Матвей', 'Роман', 'Егор', 'Арсений', 'Иван', 'Денис', 'Евгений', 'Данил', 'Тимур',
  'Владислав', 'Игорь', 'Владимир', 'Павел', 'Руслан', 'Марк', 'Лев', 'Николай', 'Степан', 'Ярослав',
  'Анна', 'Мария', 'Елена', 'Наталья', 'Ольга', 'Татьяна', 'Ирина', 'Екатерина', 'Светлана', 'Юлия',
  'Анастасия', 'Дарья', 'Полина', 'Марина', 'Александра', 'Кристина', 'Виктория', 'София', 'Валентина', 'Валерия',
  'Алина', 'Вероника', 'Алиса', 'Ксения', 'Маргарита', 'Диана', 'Ангелина', 'Елизавета', 'Карина', 'Милана'
];

const LAST_NAMES = [
  'Иванов', 'Петров', 'Сидоров', 'Смирнов', 'Кузнецов', 'Попов', 'Соколов', 'Лебедев', 'Козлов', 'Новиков',
  'Морозов', 'Петров', 'Волков', 'Соловьев', 'Васильев', 'Зайцев', 'Павлов', 'Семенов', 'Голубев', 'Виноградов',
  'Богданов', 'Воробьев', 'Федоров', 'Михайлов', 'Белов', 'Тарасов', 'Беляев', 'Комаров', 'Орлов', 'Киселев',
  'Макаров', 'Андреев', 'Ковалев', 'Ильин', 'Гусев', 'Титов', 'Кузьмин', 'Кудрявцев', 'Баранов', 'Куликов',
  'Алексеев', 'Степанов', 'Яковлев', 'Сорокин', 'Сергеев', 'Романов', 'Захаров', 'Борисов', 'Королев', 'Герасимов',
  'Пономарев', 'Григорьев', 'Лазарев', 'Медведев', 'Ершов', 'Никитин', 'Соболев', 'Рябов', 'Поляков', 'Цветков',
  'Данилов', 'Жуков', 'Фролов', 'Журавлев', 'Николаев', 'Крылов', 'Максимов', 'Сидоров', 'Осипов', 'Марков',
  'Петухов', 'Антонов', 'Тимофеев', 'Никифоров', 'Веселов', 'Филиппов', 'Марков', 'Большаков', 'Суханов', 'Миронов'
];

const DOMAINS = ['example.com', 'test.com', 'demo.ru', 'sample.org'];

function generateRandomUser(index: number): {
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  authProvider: 'local' | 'google' | 'yandex';
  providerId: string;
  password?: string;
} {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const displayName = `${firstName} ${lastName}`;
  
  // Распределяем пользователей между провайдерами: 50% local, 30% google, 20% yandex
  const providerType = index % 10;
  let authProvider: 'local' | 'google' | 'yandex';
  let email: string;
  let providerId: string;
  let password: string | undefined;

  if (providerType < 5) {
    // 50% local
    authProvider = 'local';
    email = `user${index}@${DOMAINS[Math.floor(Math.random() * DOMAINS.length)]}`;
    providerId = email;
    password = 'password123'; // Будет захеширован позже
  } else if (providerType < 8) {
    // 30% google
    authProvider = 'google';
    email = `user${index}@gmail.com`;
    providerId = `google_${Date.now()}_${index}_${Math.random().toString(36).substring(7)}`;
  } else {
    // 20% yandex
    authProvider = 'yandex';
    email = `user${index}@yandex.ru`;
    providerId = `yandex_${Date.now()}_${index}_${Math.random().toString(36).substring(7)}`;
  }

  return {
    email,
    firstName,
    lastName,
    displayName,
    authProvider,
    providerId,
    password
  };
}

async function createBulkUsers(count: number = 3000) {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const userService = app.get(UserService);

  try {
    console.log(`Начинаем создание ${count} пользователей...`);
    const startTime = Date.now();

    const BATCH_SIZE = 100; // Размер батча для оптимизации
    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Генерируем всех пользователей заранее
    const usersToCreate = [];
    for (let i = 1; i <= count; i++) {
      usersToCreate.push(generateRandomUser(i));
    }

    // Обрабатываем батчами
    for (let i = 0; i < usersToCreate.length; i += BATCH_SIZE) {
      const batch = usersToCreate.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(usersToCreate.length / BATCH_SIZE);

      console.log(`Обработка батча ${batchNumber}/${totalBatches} (${batch.length} пользователей)...`);

      // Создаем пользователей в батче параллельно
      const batchPromises = batch.map(async (userData) => {
        try {
          // Проверяем, существует ли пользователь
          const existingUser = await userService.findByEmail(userData.email);
          if (existingUser) {
            skippedCount++;
            return null;
          }

          // Подготавливаем данные пользователя
          const userToCreate: any = {
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            displayName: userData.displayName,
            authProvider: userData.authProvider,
            providerId: userData.providerId,
            isActive: true,
            roleId: undefined
          };

          // Добавляем пароль для локальных пользователей
          if (userData.authProvider === 'local' && userData.password) {
            const saltRounds = 10;
            userToCreate.password = await bcrypt.hash(userData.password, saltRounds);
          }

          // Создаем пользователя
          await userService.create(userToCreate);
          createdCount++;
          return userData.email;
        } catch (error) {
          errorCount++;
          console.error(`Ошибка при создании пользователя ${userData.email}:`, error instanceof Error ? error.message : error);
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
    console.log(`- Создано пользователей: ${createdCount}`);
    console.log(`- Пропущено (уже существуют): ${skippedCount}`);
    console.log(`- Ошибок: ${errorCount}`);
    console.log(`- Всего обработано: ${count}`);
    console.log(`- Время выполнения: ${duration} секунд`);
    console.log(`- Средняя скорость: ${(createdCount / parseFloat(duration)).toFixed(2)} пользователей/сек`);

  } catch (error) {
    console.error('Критическая ошибка при создании пользователей:', error);
  } finally {
    await app.close();
  }
}

// Запуск скрипта
if (require.main === module) {
  const count = process.argv[2] ? parseInt(process.argv[2], 10) : 3000;
  if (isNaN(count) || count <= 0) {
    console.error('Неверное количество пользователей. Используется значение по умолчанию: 3000');
    createBulkUsers(3000);
  } else {
    createBulkUsers(count);
  }
}

