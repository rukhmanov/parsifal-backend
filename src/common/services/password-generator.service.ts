import { Injectable } from '@nestjs/common';

@Injectable()
export class PasswordGeneratorService {
  private readonly lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
  private readonly uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  private readonly numberChars = '0123456789';
  private readonly specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  /**
   * Генерирует случайный пароль, соответствующий требованиям безопасности
   * @param length - длина пароля (по умолчанию 12)
   * @returns сгенерированный пароль
   */
  generatePassword(length: number = 12): string {
    if (length < 8) {
      throw new Error('Минимальная длина пароля должна быть 8 символов');
    }

    let password = '';

    // Гарантируем наличие хотя бы одного символа каждого типа
    password += this.getRandomChar(this.lowercaseChars);
    password += this.getRandomChar(this.uppercaseChars);
    password += this.getRandomChar(this.numberChars);
    password += this.getRandomChar(this.specialChars);

    // Заполняем оставшиеся позиции случайными символами
    const allChars = this.lowercaseChars + this.uppercaseChars + this.numberChars + this.specialChars;
    for (let i = 4; i < length; i++) {
      password += this.getRandomChar(allChars);
    }

    // Перемешиваем символы для случайности
    return this.shuffleString(password);
  }

  /**
   * Генерирует несколько вариантов паролей
   * @param count - количество паролей для генерации
   * @param length - длина каждого пароля
   * @returns массив сгенерированных паролей
   */
  generateMultiplePasswords(count: number = 3, length: number = 12): string[] {
    const passwords: string[] = [];
    for (let i = 0; i < count; i++) {
      passwords.push(this.generatePassword(length));
    }
    return passwords;
  }

  /**
   * Проверяет, соответствует ли пароль требованиям безопасности
   * @param password - пароль для проверки
   * @returns true, если пароль соответствует требованиям
   */
  isPasswordStrong(password: string): boolean {
    if (!password || password.length < 8) return false;
    if (!/[a-z]/.test(password)) return false;
    if (!/[A-Z]/.test(password)) return false;
    if (!/\d/.test(password)) return false;
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return false;
    return true;
  }

  /**
   * Получает случайный символ из строки
   * @param chars - строка с символами
   * @returns случайный символ
   */
  private getRandomChar(chars: string): string {
    return chars.charAt(Math.floor(Math.random() * chars.length));
  }

  /**
   * Перемешивает символы в строке
   * @param str - строка для перемешивания
   * @returns перемешанная строка
   */
  private shuffleString(str: string): string {
    const arr = str.split('');
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join('');
  }
}
