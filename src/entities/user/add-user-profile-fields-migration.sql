-- Миграция для добавления полей профиля пользователя
-- Выполните этот скрипт вручную в базе данных

-- Добавляем поле "Расскажите о себе"
ALTER TABLE users ADD COLUMN IF NOT EXISTS about TEXT;

-- Добавляем поле "Работа"
ALTER TABLE users ADD COLUMN IF NOT EXISTS work VARCHAR(255);

-- Добавляем поле "Интересы" (simple-array в TypeORM хранится как TEXT с разделителями)
-- Если поле уже существует как TEXT, можно оставить как есть - TypeORM автоматически преобразует
ALTER TABLE users ADD COLUMN IF NOT EXISTS interests TEXT;


