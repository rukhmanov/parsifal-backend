-- Миграция для исправления проблемы с колонкой type в таблице chats
-- Выполните этот скрипт вручную в базе данных перед запуском приложения

-- 1. Создаем enum тип, если его еще нет
DO $$ BEGIN
    CREATE TYPE chats_type_enum AS ENUM ('user', 'event');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Добавляем колонку type как nullable
ALTER TABLE chats ADD COLUMN IF NOT EXISTS type chats_type_enum;

-- 3. Заполняем существующие записи значением по умолчанию
UPDATE chats SET type = 'user' WHERE type IS NULL;

-- 4. Теперь можно сделать колонку NOT NULL (раскомментируйте, если нужно)
-- ALTER TABLE chats ALTER COLUMN type SET NOT NULL;
-- ALTER TABLE chats ALTER COLUMN type SET DEFAULT 'user';

