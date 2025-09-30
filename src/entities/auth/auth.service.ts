import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { YandexStrategy, YandexUserInfo } from './strategies/yandex.strategy';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import axios from 'axios';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';

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
  ) {}

  // Нормализация данных от Google
  private normalizeGoogleData(googleUser: any): UnifiedUserData {
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
  private normalizeYandexData(yandexUser: YandexUserInfo): UnifiedUserData {
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

  // Единый метод для обработки пользователей от OAuth провайдеров
  private async processOAuthUser(userData: UnifiedUserData): Promise<User> {
    console.log('Processing OAuth user:', userData);
    
    // Ищем существующего пользователя
    let user = await this.userService.findByEmailAndProvider(
      userData.email, 
      userData.providerId, 
      userData.authProvider
    );
    
    if (user) {
      console.log('Found existing user:', user);
      // Обновляем данные существующего пользователя
      const updatedUser = await this.userService.update(user.id, {
        firstName: userData.firstName,
        lastName: userData.lastName,
        displayName: userData.displayName || `${userData.firstName} ${userData.lastName}`.trim(),
        avatar: userData.avatar,
      });
      console.log('Updated user:', updatedUser);
      return updatedUser!;
    } else {
      console.log('Creating new user...');
      // Создаем нового пользователя
      const newUser = await this.userService.create({
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        displayName: userData.displayName || `${userData.firstName} ${userData.lastName}`.trim(),
        avatar: userData.avatar,
        authProvider: userData.authProvider,
        providerId: userData.providerId,
        isActive: true,
      });
      console.log('Created new user:', newUser);
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
        return await this.processOAuthUser(normalizedData);
      } else if (provider === 'yandex') {
        const response = await axios.get('https://login.yandex.ru/info', {
          headers: {
            Authorization: `OAuth ${accessToken}`,
          },
        });
        userInfo = response.data;
        const normalizedData = this.normalizeYandexData(userInfo);
        return await this.processOAuthUser(normalizedData);
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
      console.log('JWT payload:', payload);
      
      // Получаем пользователя из БД
      const user = await this.userService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      
      console.log('Validated user:', user);
      return user;
    } catch (error) {
      console.error('JWT validation error:', error);
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

    // Создаем нового пользователя
    const newUser = await this.userService.create({
      email,
      firstName,
      lastName,
      displayName: `${firstName} ${lastName}`.trim(),
      authProvider: 'local',
      providerId: email,
      password: hashedPassword,
      isActive: true,
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

  // Метод для получения всех пользователей (для отладки)
  async getAllUsers(): Promise<User[]> {
    return await this.userService.findAll();
  }

  // Метод для получения количества пользователей (для отладки)
  async getUserCount(): Promise<number> {
    return await this.userService.getCount();
  }
}