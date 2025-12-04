/**
 * DTO для безопасного возврата данных пользователя
 * Исключает чувствительные поля: password, resetToken, authProvider, email и т.д.
 */
export interface SafeUserDto {
  id: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  avatar?: string;
  photos?: string[];
  birthDate?: Date;
  gender?: 'male' | 'female';
}

/**
 * Преобразует User entity в безопасный DTO
 */
export function toSafeUserDto(user: any): SafeUserDto {
  if (!user) {
    return null as any;
  }
  
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName,
    avatar: user.avatar,
    photos: user.photos,
    birthDate: user.birthDate,
    gender: user.gender,
  };
}

/**
 * Преобразует массив User entities в массив безопасных DTO
 */
export function toSafeUserDtoArray(users: any[]): SafeUserDto[] {
  if (!users || !Array.isArray(users)) {
    return [];
  }
  return users.map(user => toSafeUserDto(user));
}

