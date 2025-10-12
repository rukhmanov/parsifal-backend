import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { S3Service } from '../common/services/s3.service';

async function checkFileTree() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const s3Service = app.get(S3Service);

  try {
    console.log('Проверяем структуру файлов...');
    
    // Получаем дерево файлов
    const tree = await s3Service.getFileTree();
    
    console.log('Структура файлов:');
    console.log(JSON.stringify(tree, null, 2));
    
    // Проверяем, есть ли папка undefined
    const hasUndefinedFolder = JSON.stringify(tree).includes('"name":"undefined"');
    
    if (hasUndefinedFolder) {
      console.log('❌ Папка "undefined" все еще существует!');
    } else {
      console.log('✅ Папка "undefined" не найдена - очистка прошла успешно!');
    }
    
  } catch (error) {
    console.error('Ошибка при проверке файлов:', error);
  } finally {
    await app.close();
  }
}

// Запускаем скрипт
checkFileTree().catch((error) => {
  console.error('Критическая ошибка:', error);
  process.exit(1);
});
