-- Миграция для добавления поля hideAddressForNonParticipants в таблицу events
-- Выполните этот скрипт вручную в базе данных перед запуском приложения в продакшене

-- Добавляем колонку hideAddressForNonParticipants как boolean с значением по умолчанию false
ALTER TABLE events ADD COLUMN IF NOT EXISTS "hideAddressForNonParticipants" boolean NOT NULL DEFAULT false;

