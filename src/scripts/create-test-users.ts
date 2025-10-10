import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UserService } from '../entities/user/user.service';
import { RoleService } from '../entities/role/role.service';
import * as bcrypt from 'bcrypt';

interface TestUser {
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  authProvider: 'local' | 'google' | 'yandex';
  providerId: string;
  password?: string;
  roleName?: string;
}

const TEST_USERS: TestUser[] = [
  // Локальные пользователи
  { email: 'test1@example.com', firstName: 'Алексей', lastName: 'Петров', displayName: 'Алексей Петров', authProvider: 'local', providerId: 'test1@example.com', password: 'password123', roleName: 'user' },
  { email: 'test2@example.com', firstName: 'Мария', lastName: 'Иванова', displayName: 'Мария Иванова', authProvider: 'local', providerId: 'test2@example.com', password: 'password123', roleName: 'user' },
  { email: 'test3@example.com', firstName: 'Дмитрий', lastName: 'Сидоров', displayName: 'Дмитрий Сидоров', authProvider: 'local', providerId: 'test3@example.com', password: 'password123', roleName: 'user' },
  { email: 'test4@example.com', firstName: 'Елена', lastName: 'Козлова', displayName: 'Елена Козлова', authProvider: 'local', providerId: 'test4@example.com', password: 'password123', roleName: 'user' },
  { email: 'test5@example.com', firstName: 'Сергей', lastName: 'Морозов', displayName: 'Сергей Морозов', authProvider: 'local', providerId: 'test5@example.com', password: 'password123', roleName: 'user' },
  { email: 'test6@example.com', firstName: 'Анна', lastName: 'Новикова', displayName: 'Анна Новикова', authProvider: 'local', providerId: 'test6@example.com', password: 'password123', roleName: 'user' },
  { email: 'test7@example.com', firstName: 'Владимир', lastName: 'Волков', displayName: 'Владимир Волков', authProvider: 'local', providerId: 'test7@example.com', password: 'password123', roleName: 'user' },
  { email: 'test8@example.com', firstName: 'Ольга', lastName: 'Лебедева', displayName: 'Ольга Лебедева', authProvider: 'local', providerId: 'test8@example.com', password: 'password123', roleName: 'user' },
  { email: 'test9@example.com', firstName: 'Игорь', lastName: 'Соколов', displayName: 'Игорь Соколов', authProvider: 'local', providerId: 'test9@example.com', password: 'password123', roleName: 'user' },
  { email: 'test10@example.com', firstName: 'Татьяна', lastName: 'Попова', displayName: 'Татьяна Попова', authProvider: 'local', providerId: 'test10@example.com', password: 'password123', roleName: 'user' },
  
  // Google пользователи
  { email: 'google1@gmail.com', firstName: 'Николай', lastName: 'Федоров', displayName: 'Николай Федоров', authProvider: 'google', providerId: 'google_123456789', roleName: 'user' },
  { email: 'google2@gmail.com', firstName: 'Светлана', lastName: 'Морозова', displayName: 'Светлана Морозова', authProvider: 'google', providerId: 'google_987654321', roleName: 'user' },
  { email: 'google3@gmail.com', firstName: 'Андрей', lastName: 'Волков', displayName: 'Андрей Волков', authProvider: 'google', providerId: 'google_456789123', roleName: 'user' },
  { email: 'google4@gmail.com', firstName: 'Наталья', lastName: 'Алексеева', displayName: 'Наталья Алексеева', authProvider: 'google', providerId: 'google_789123456', roleName: 'user' },
  { email: 'google5@gmail.com', firstName: 'Павел', lastName: 'Степанов', displayName: 'Павел Степанов', authProvider: 'google', providerId: 'google_321654987', roleName: 'user' },
  { email: 'google6@gmail.com', firstName: 'Юлия', lastName: 'Романова', displayName: 'Юлия Романова', authProvider: 'google', providerId: 'google_654987321', roleName: 'user' },
  { email: 'google7@gmail.com', firstName: 'Михаил', lastName: 'Орлов', displayName: 'Михаил Орлов', authProvider: 'google', providerId: 'google_147258369', roleName: 'user' },
  { email: 'google8@gmail.com', firstName: 'Ирина', lastName: 'Соколова', displayName: 'Ирина Соколова', authProvider: 'google', providerId: 'google_369258147', roleName: 'user' },
  { email: 'google9@gmail.com', firstName: 'Роман', lastName: 'Медведев', displayName: 'Роман Медведев', authProvider: 'google', providerId: 'google_741852963', roleName: 'user' },
  { email: 'google10@gmail.com', firstName: 'Валентина', lastName: 'Зайцева', displayName: 'Валентина Зайцева', authProvider: 'google', providerId: 'google_963852741', roleName: 'user' },
  
  // Yandex пользователи
  { email: 'yandex1@yandex.ru', firstName: 'Константин', lastName: 'Белов', displayName: 'Константин Белов', authProvider: 'yandex', providerId: 'yandex_111222333', roleName: 'user' },
  { email: 'yandex2@yandex.ru', firstName: 'Лариса', lastName: 'Крылова', displayName: 'Лариса Крылова', authProvider: 'yandex', providerId: 'yandex_444555666', roleName: 'user' },
  { email: 'yandex3@yandex.ru', firstName: 'Станислав', lastName: 'Герасимов', displayName: 'Станислав Герасимов', authProvider: 'yandex', providerId: 'yandex_777888999', roleName: 'user' },
  { email: 'yandex4@yandex.ru', firstName: 'Галина', lastName: 'Титова', displayName: 'Галина Титова', authProvider: 'yandex', providerId: 'yandex_123456789', roleName: 'user' },
  { email: 'yandex5@yandex.ru', firstName: 'Артем', lastName: 'Кузьмин', displayName: 'Артем Кузьмин', authProvider: 'yandex', providerId: 'yandex_987654321', roleName: 'user' },
  { email: 'yandex6@yandex.ru', firstName: 'Екатерина', lastName: 'Кудрявцева', displayName: 'Екатерина Кудрявцева', authProvider: 'yandex', providerId: 'yandex_456789123', roleName: 'user' },
  { email: 'yandex7@yandex.ru', firstName: 'Виктор', lastName: 'Борисов', displayName: 'Виктор Борисов', authProvider: 'yandex', providerId: 'yandex_789123456', roleName: 'user' },
  { email: 'yandex8@yandex.ru', firstName: 'Жанна', lastName: 'Королева', displayName: 'Жанна Королева', authProvider: 'yandex', providerId: 'yandex_321654987', roleName: 'user' },
  { email: 'yandex9@yandex.ru', firstName: 'Эдуард', lastName: 'Григорьев', displayName: 'Эдуард Григорьев', authProvider: 'yandex', providerId: 'yandex_654987321', roleName: 'user' },
  { email: 'yandex10@yandex.ru', firstName: 'Зоя', lastName: 'Смирнова', displayName: 'Зоя Смирнова', authProvider: 'yandex', providerId: 'yandex_147258369', roleName: 'user' }
];

async function createTestUsers() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const userService = app.get(UserService);
  const roleService = app.get(RoleService);

  try {
    console.log('Создание тестовых пользователей...');
    
    // Получаем роли
    const roles = await roleService.findAll();
    const userRole = roles.find(role => role.name === 'Пользователь');
    
    if (!userRole) {
      console.error('Роль "Пользователь" не найдена. Сначала запустите скрипт инициализации ролей.');
      return;
    }

    let createdCount = 0;
    let skippedCount = 0;

    for (const userData of TEST_USERS) {
      try {
        // Проверяем, существует ли пользователь
        const existingUser = await userService.findByEmail(userData.email);
        if (existingUser) {
          console.log(`Пользователь ${userData.email} уже существует, пропускаем`);
          skippedCount++;
          continue;
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
          roleId: userRole.id
        };

        // Добавляем пароль для локальных пользователей
        if (userData.authProvider === 'local' && userData.password) {
          const saltRounds = 10;
          userToCreate.password = await bcrypt.hash(userData.password, saltRounds);
        }

        // Создаем пользователя
        await userService.create(userToCreate);
        console.log(`Создан пользователь: ${userData.email} (${userData.authProvider})`);
        createdCount++;

      } catch (error) {
        console.error(`Ошибка при создании пользователя ${userData.email}:`, error instanceof Error ? error.message : error);
      }
    }

    console.log(`\nРезультат:`);
    console.log(`- Создано пользователей: ${createdCount}`);
    console.log(`- Пропущено (уже существуют): ${skippedCount}`);
    console.log(`- Всего обработано: ${TEST_USERS.length}`);

  } catch (error) {
    console.error('Ошибка при создании тестовых пользователей:', error);
  } finally {
    await app.close();
  }
}

// Запуск скрипта
if (require.main === module) {
  createTestUsers();
}
