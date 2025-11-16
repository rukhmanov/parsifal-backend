-- Исправление проблемы с колонкой type в таблице chats
-- Выполните этот скрипт в базе данных

-- 1. Создаем enum тип, если его еще нет
DO $$ BEGIN
    CREATE TYPE chats_type_enum AS ENUM ('user', 'event');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Добавляем колонку type как nullable (если её еще нет)
DO $$ BEGIN
    ALTER TABLE chats ADD COLUMN type chats_type_enum;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- 3. Заполняем существующие записи значением по умолчанию
UPDATE chats SET type = 'user' WHERE type IS NULL;

-- 4. Теперь можно сделать колонку NOT NULL с default
ALTER TABLE chats ALTER COLUMN type SET NOT NULL;
ALTER TABLE chats ALTER COLUMN type SET DEFAULT 'user';
