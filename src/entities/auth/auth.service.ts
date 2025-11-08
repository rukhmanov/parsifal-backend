import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { YandexStrategy, YandexUserInfo } from './strategies/yandex.strategy';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import axios from 'axios';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';
import * as crypto from 'crypto';
import { EmailNewService } from '../../common/email-new.service';

// Единый интерфейс для данных от разных провайдеров
export interface UnifiedUserData {
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  avatar?: string;
  authProvider: 'google' | 'yandex';
  providerId: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  authProvider: 'google' | 'yandex' | 'local';
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatar?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly yandexStrategy: YandexStrategy,
    private readonly userService: UserService,
    private readonly emailNewService: EmailNewService,
  ) {}

  // Нормализация данных от Google
  normalizeGoogleData(googleUser: any): UnifiedUserData {
    const firstName = googleUser.given_name || googleUser.firstName || googleUser.name?.split(' ')[0] || 'User';
    const lastName = googleUser.family_name || googleUser.lastName || googleUser.name?.split(' ')[1] || '';
    const displayName = googleUser.name || `${firstName} ${lastName}`.trim();
    
    return {
      email: googleUser.email,
      firstName,
      lastName,
      displayName,
      avatar: googleUser.picture,
      authProvider: 'google',
      providerId: googleUser.id || googleUser.googleId,
    };
  }

  // Нормализация данных от Yandex
  normalizeYandexData(yandexUser: YandexUserInfo): UnifiedUserData {
    const firstName = yandexUser.first_name || yandexUser.real_name?.split(' ')[0] || 'User';
    const lastName = yandexUser.last_name || yandexUser.real_name?.split(' ')[1] || '';
    const displayName = yandexUser.display_name || yandexUser.real_name || `${firstName} ${lastName}`.trim();
    const avatar = yandexUser.default_avatar_id ? 
      `https://avatars.yandex.net/get-yapic/${yandexUser.default_avatar_id}/islands-200` : 
      undefined;
    
    return {
      email: yandexUser.default_email,
      firstName,
      lastName,
      displayName,
      avatar,
      authProvider: 'yandex',
      providerId: yandexUser.id,
    };
  }

  // Получение информации о пользователе напрямую от Yandex
  async getYandexUserInfoFromProvider(accessToken: string): Promise<any> {
    try {
      const response = await axios.get('https://login.yandex.ru/info', {
        headers: {
          Authorization: `OAuth ${accessToken}`,
        },
      });
      return response.data;
    } catch (error) {
      throw new Error('Failed to get user info from Yandex');
    }
  }

  // Получение информации о пользователе напрямую от Google
  async getGoogleUserInfoFromProvider(accessToken: string): Promise<any> {
    try {
      const response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      return response.data;
    } catch (error) {
      throw new Error('Failed to get user info from Google');
    }
  }

  // Единый метод для обработки пользователей от OAuth провайдеров
  async processOAuthUser(userData: UnifiedUserData, shouldUpdate: boolean = true): Promise<User> {
    // Ищем существующего пользователя
    let user = await this.userService.findByEmailAndProvider(
      userData.email, 
      userData.providerId, 
      userData.authProvider
    );
    
    if (user) {
      // Обновляем данные существующего пользователя только если явно указано
      if (shouldUpdate) {
        const updatedUser = await this.userService.update(user.id, {
          firstName: userData.firstName,
          lastName: userData.lastName,
          displayName: userData.displayName || `${userData.firstName} ${userData.lastName}`.trim(),
          avatar: userData.avatar,
        });
        return updatedUser!;
      } else {
        // Возвращаем существующего пользователя без обновления
        return user;
      }
    } else {
      // Создаем нового пользователя без роли (roleId будет null)
      const newUser = await this.userService.create({
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        displayName: userData.displayName || `${userData.firstName} ${userData.lastName}`.trim(),
        avatar: userData.avatar,
        authProvider: userData.authProvider,
        providerId: userData.providerId,
        isActive: true,
        roleId: undefined, // Пользователь создается без роли
      });
      return newUser;
    }
  }

  async validateGoogleUser(googleUser: any): Promise<User> {
    const normalizedData = this.normalizeGoogleData(googleUser);
    return await this.processOAuthUser(normalizedData);
  }

  async validateYandexUser(code: string): Promise<User> {
    try {
      const tokenResponse = await this.yandexStrategy.exchangeCodeForToken(code);
      const userInfo: YandexUserInfo = await this.yandexStrategy.getUserInfo(
        tokenResponse.access_token,
      );

      const normalizedData = this.normalizeYandexData(userInfo);
      return await this.processOAuthUser(normalizedData);
    } catch (error) {
      throw new UnauthorizedException('Failed to authenticate with Yandex');
    }
  }

  // Метод для обработки пользователя по access token (для случаев когда токен уже получен)
  async validateUserByAccessToken(accessToken: string, provider: 'google' | 'yandex'): Promise<User> {
    try {
      let userInfo: any;
      
      if (provider === 'google') {
        const response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        userInfo = response.data;
        const normalizedData = this.normalizeGoogleData(userInfo);
        
        // Проверяем, есть ли пользователь в БД
        const existingUser = await this.userService.findByEmailAndProvider(
          normalizedData.email, 
          normalizedData.providerId, 
          normalizedData.authProvider
        );
        
        if (existingUser && !existingUser.avatar && normalizedData.avatar) {
          // Если пользователь есть, но нет аватара, обновляем только аватар
          await this.userService.update(existingUser.id, { avatar: normalizedData.avatar });
          const updatedUser = await this.userService.findById(existingUser.id);
          return updatedUser!;
        }
        
        // При валидации токена не обновляем данные пользователя
        return await this.processOAuthUser(normalizedData, false);
      } else if (provider === 'yandex') {
        const response = await axios.get('https://login.yandex.ru/info', {
          headers: {
            Authorization: `OAuth ${accessToken}`,
          },
        });
        userInfo = response.data;
        const normalizedData = this.normalizeYandexData(userInfo);
        // При валидации токена не обновляем данные пользователя
        return await this.processOAuthUser(normalizedData, false);
      }
      
      throw new Error('Unsupported provider');
    } catch (error) {
      throw new UnauthorizedException(`Failed to authenticate with ${provider}`);
    }
  }

  async generateJwtToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      authProvider: user.authProvider,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      avatar: user.avatar,
    };

    return this.jwtService.sign(payload);
  }

  async verifyJwtToken(token: string): Promise<JwtPayload> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async validateJwtToken(token: string): Promise<User> {
    try {
      const payload = await this.verifyJwtToken(token);
      
      // Получаем пользователя из БД с загрузкой связанной роли
      const user = await this.userService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      
      return user;
    } catch (error) {
      throw new UnauthorizedException('Invalid JWT token');
    }
  }

  // Методы для локальной аутентификации
  async register(registerDto: RegisterDto): Promise<User> {
    const { email, password, firstName, lastName } = registerDto;

    // Проверяем, существует ли пользователь с таким email
    const existingUser = await this.userService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Пользователь с таким email уже существует');
    }

    // Хешируем пароль
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Создаем нового пользователя без роли (roleId будет null)
    const newUser = await this.userService.create({
      email,
      firstName,
      lastName,
      displayName: `${firstName} ${lastName}`.trim(),
      authProvider: 'local',
      providerId: email,
      password: hashedPassword,
      isActive: true,
      roleId: undefined, // Пользователь создается без роли
    });

    // Возвращаем пользователя без пароля
    const { password: _, ...userWithoutPassword } = newUser;
    return userWithoutPassword as User;
  }

  async validateLocalUser(email: string, password: string): Promise<User | null> {
    const user = await this.userService.findByEmail(email);
    if (!user || !user.password) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    // Возвращаем пользователя без пароля
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      return null;
    }

    // Возвращаем пользователя без пароля
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  // Метод для явного обновления данных пользователя из OAuth провайдера
  async updateUserFromOAuthProvider(userId: string, provider: 'google' | 'yandex'): Promise<User> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.authProvider !== provider) {
      throw new UnauthorizedException('Invalid provider for user');
    }

    try {
      if (provider === 'google') {
        // Для Google нужно получить access token из сессии или других источников
        // Пока что возвращаем существующего пользователя
        return user;
      } else if (provider === 'yandex') {
        // Для Yandex нужно получить access token из сессии или других источников
        // Пока что возвращаем существующего пользователя
        return user;
      }
      
      throw new Error('Unsupported provider');
    } catch (error) {
      throw new UnauthorizedException(`Failed to update user from ${provider}`);
    }
  }

  // Метод для отправки запроса на восстановление пароля
  async forgotPassword(email: string): Promise<{ message: string }> {
    // Ищем только локальных пользователей для восстановления пароля
    const user = await this.userService.findByEmailAndAuthProvider(email, 'local');
    if (!user) {
      // Не раскрываем информацию о том, существует ли пользователь
      return { message: 'Если аккаунт с таким email существует, на него будет отправлена ссылка для восстановления пароля' };
    }

    // Проверяем, что у пользователя есть пароль (дополнительная проверка)
    if (!user.password) {
      return { message: 'Если аккаунт с таким email существует, на него будет отправлена ссылка для восстановления пароля' };
    }

    // Генерируем уникальный токен восстановления
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // Ссылка действительна 1 час

    // Сохраняем токен и срок его действия в базе данных
    await this.userService.updateResetToken(user.id, resetToken, resetTokenExpiry);

    // Формируем ссылку для восстановления пароля
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    try {
      // Отправляем email с ссылкой для сброса пароля
      await this.emailNewService.sendPasswordResetEmail(email, resetUrl);
    } catch (error) {
      // Не раскрываем ошибку пользователю для безопасности
    }

    return { message: 'Если аккаунт с таким email существует, на него будет отправлена ссылка для восстановления пароля' };
  }

  // Метод для сброса пароля по токену
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.userService.findByResetToken(token);
    
    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      throw new UnauthorizedException('Недействительная или истекшая ссылка для восстановления пароля');
    }

    // Дополнительная проверка: убеждаемся, что пользователь зарегистрирован локально
    if (user.authProvider !== 'local') {
      throw new UnauthorizedException('Недействительная или истекшая ссылка для восстановления пароля');
    }

    // Хэшируем новый пароль
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Обновляем пароль пользователя и очищаем токен восстановления
    await this.userService.updatePassword(user.id, hashedPassword);
    await this.userService.clearResetToken(user.id);

    return { message: 'Пароль успешно изменен' };
  }

  // Метод для получения пользователя с ролями и пермишенами
  async getUserWithPermissions(userId: string): Promise<User | null> {
    return await this.userService.findById(userId);
  }

  // Метод для формирования ответа с пермишенами для всех типов авторизации
  formatUserResponseWithPermissions(user: User): any {
    const permissions = user.role?.permissions?.map(permission => ({
      id: permission.id,
      name: permission.name,
      code: permission.code,
      description: permission.description
    })) || [];

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      avatar: user.avatar,
      roleId: user.roleId,
      isActive: user.isActive,
      role: user.role ? { 
        id: user.role.id, 
        name: user.role.name,
        description: user.role.description
      } : null,
      permissions: permissions
    };
  }
}