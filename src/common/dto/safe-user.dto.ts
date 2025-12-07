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

/**
 * DTO для администраторов - включает больше полей, но исключает чувствительные данные
 */
export interface AdminUserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  avatar?: string;
  photos?: string[];
  birthDate?: Date;
  gender?: 'male' | 'female';
  authProvider: 'google' | 'yandex' | 'local';
  providerId: string;
  isActive: boolean;
  isBlocked?: boolean;
  blockReason?: string;
  blockedUntil?: Date;
  termsAccepted?: boolean;
  termsAcceptedAt?: Date;
  privacyAccepted?: boolean;
  privacyAcceptedAt?: Date;
  roleId?: string;
  role?: any;
  createdAt: Date;
  updatedAt: Date;
  // Исключены: password, resetToken, resetTokenExpiry
}

/**
 * Преобразует User entity в DTO для администраторов
 * Исключает чувствительные поля: password, resetToken, resetTokenExpiry
 */
export function toAdminUserDto(user: any): AdminUserDto {
  if (!user) {
    return null as any;
  }
  
  const { password, resetToken, resetTokenExpiry, ...safeUser } = user;
  
  return {
    id: safeUser.id,
    email: safeUser.email,
    firstName: safeUser.firstName,
    lastName: safeUser.lastName,
    displayName: safeUser.displayName,
    avatar: safeUser.avatar,
    photos: safeUser.photos,
    birthDate: safeUser.birthDate,
    gender: safeUser.gender,
    authProvider: safeUser.authProvider,
    providerId: safeUser.providerId,
    isActive: safeUser.isActive,
    isBlocked: safeUser.isBlocked,
    blockReason: safeUser.blockReason,
    blockedUntil: safeUser.blockedUntil,
    termsAccepted: safeUser.termsAccepted,
    termsAcceptedAt: safeUser.termsAcceptedAt,
    privacyAccepted: safeUser.privacyAccepted,
    privacyAcceptedAt: safeUser.privacyAcceptedAt,
    roleId: safeUser.roleId,
    role: safeUser.role,
    createdAt: safeUser.createdAt,
    updatedAt: safeUser.updatedAt,
  };
}


