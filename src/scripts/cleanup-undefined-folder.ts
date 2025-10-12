import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { S3Service } from '../common/services/s3.service';

async function cleanupUndefinedFolder() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const s3Service = app.get(S3Service);

  try {
    console.log('Начинаем очистку папки "undefined"...');
    
    // Удаляем папку users/undefined/
    await s3Service.deleteFolder('users/undefined');
    
    console.log('Папка "undefined" успешно удалена!');
    
  } catch (error) {
    console.error('Ошибка при удалении папки "undefined":', error);
  } finally {
    await app.close();
  }
}

// Запускаем скрипт
cleanupUndefinedFolder().catch((error) => {
  console.error('Критическая ошибка:', error);
  process.exit(1);
});
