import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UserService } from '../entities/user/user.service';
import * as bcrypt from 'bcrypt';

async function createSingleUser() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const userService = app.get(UserService);

  try {
    const email = 'test@test.com';
    const password = '123123';
    const firstName = 'Test';
    const lastName = 'User';
    const displayName = 'Test User';

    console.log(`Создание пользователя ${email}...`);

    // Проверяем, существует ли пользователь
    const existingUser = await userService.findByEmail(email);
    if (existingUser) {
      console.log(`Пользователь ${email} уже существует!`);
      await app.close();
      return;
    }

    // Хешируем пароль
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Подготавливаем данные пользователя
    const userToCreate: any = {
      email: email,
      firstName: firstName,
      lastName: lastName,
      displayName: displayName,
      authProvider: 'local',
      providerId: email,
      password: hashedPassword,
      isActive: true,
      roleId: undefined // Пользователь создается без роли
    };

    // Создаем пользователя
    await userService.create(userToCreate);
    console.log(`\n✅ Пользователь успешно создан!`);
    console.log(`Email: ${email}`);
    console.log(`Пароль: ${password}`);

  } catch (error) {
    console.error('Ошибка при создании пользователя:', error instanceof Error ? error.message : error);
  } finally {
    await app.close();
  }
}

// Запуск скрипта
if (require.main === module) {
  createSingleUser();
}

