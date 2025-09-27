Для работы Google OAuth необходимо:
1. Перейти в Google Cloud Console (https://console.cloud.google.com/)
2. Создать новый проект или выбрать существующий
3. Включить Google+ API
4. Перейти в 'Credentials' -> 'Create Credentials' -> 'OAuth 2.0 Client IDs'
5. Выбрать 'Web application'
6. Добавить Authorized redirect URIs:
   - http://localhost:8100/google-callback
7. Скопировать Client ID и Client Secret
8. Обновить файл .env с реальными значениями
