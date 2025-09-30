import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { YandexStrategy, YandexUserInfo } from './strategies/yandex.strategy';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  picture?: string;
  provider: 'google' | 'yandex' | 'local';
  providerId: string;
  password?: string; // Только для локальных пользователей
}

export interface JwtPayload {
  sub: string;
  email: string;
  provider: 'google' | 'yandex' | 'local';
  firstName?: string;
  lastName?: string;
  picture?: string;
}

@Injectable()
export class AuthService {
  // Временное хранилище пользователей (в реальном проекте используйте базу данных)
  private users: User[] = [];

  constructor(
    private readonly jwtService: JwtService,
    private readonly yandexStrategy: YandexStrategy,
  ) {}

  async validateGoogleUser(googleUser: any): Promise<User> {
    return {
      id: googleUser.googleId,
      email: googleUser.email,
      firstName: googleUser.firstName,
      lastName: googleUser.lastName,
      picture: googleUser.picture,
      provider: 'google',
      providerId: googleUser.googleId,
    };
  }

  async validateYandexUser(code: string): Promise<User> {
    try {
      const tokenResponse = await this.yandexStrategy.exchangeCodeForToken(code);
      const userInfo: YandexUserInfo = await this.yandexStrategy.getUserInfo(
        tokenResponse.access_token,
      );

      return {
        id: userInfo.id,
        email: userInfo.default_email,
        firstName: userInfo.first_name,
        lastName: userInfo.last_name,
        picture: userInfo.default_avatar_id ? 
          `https://avatars.yandex.net/get-yapic/${userInfo.default_avatar_id}/islands-200` : 
          undefined,
        provider: 'yandex',
        providerId: userInfo.id,
      };
    } catch (error) {
      throw new UnauthorizedException('Failed to authenticate with Yandex');
    }
  }

  async generateJwtToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      provider: user.provider,
      firstName: user.firstName,
      lastName: user.lastName,
      picture: user.picture,
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
      
      // Возвращаем пользователя на основе JWT payload
      const user = {
        id: payload.sub,
        email: payload.email,
        firstName: payload.firstName || payload.email.split('@')[0],
        lastName: payload.lastName || '',
        picture: payload.picture,
        provider: payload.provider,
        providerId: payload.sub,
      };
      
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
    const existingUser = this.users.find(user => user.email === email);
    if (existingUser) {
      throw new ConflictException('Пользователь с таким email уже существует');
    }

    // Хешируем пароль
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Создаем нового пользователя
    const newUser: User = {
      id: Date.now().toString(), // Временный ID
      email,
      firstName,
      lastName,
      provider: 'local',
      providerId: email,
      password: hashedPassword,
    };

    this.users.push(newUser);

    // Возвращаем пользователя без пароля
    const { password: _, ...userWithoutPassword } = newUser;
    return userWithoutPassword as User;
  }

  async validateLocalUser(email: string, password: string): Promise<User | null> {
    const user = this.users.find(u => u.email === email);
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
    const user = this.users.find(u => u.email === email);
    if (!user) {
      return null;
    }

    // Возвращаем пользователя без пароля
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }
}