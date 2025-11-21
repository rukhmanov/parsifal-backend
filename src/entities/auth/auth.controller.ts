import { Controller, Get, Post, Query, Req, Res, UseGuards, Body, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { EmailNewService } from '../../common/email-new.service';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';
import { FilterQuery, FilterBody } from '../../common/decorators/filter.decorator';
import { FilterRequestDto } from '../../common/dto/filter.dto';
import { PasswordGeneratorService } from '../../common/services/password-generator.service';
import { FriendRequestService } from '../friend-request/friend-request.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import axios from 'axios';

export interface GoogleCallbackRequest extends Request {
  user: any;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailNewService: EmailNewService,
    private readonly userService: UserService,
    private readonly passwordGeneratorService: PasswordGeneratorService,
    private readonly friendRequestService: FriendRequestService,
  ) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(): Promise<void> {
    // Guard redirects to Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @Req() req: GoogleCallbackRequest,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const user = await this.authService.validateGoogleUser(req.user);
      const token = await this.authService.generateJwtToken(user);
      
      // Redirect to frontend with token
      res.redirect(`${process.env.FRONTEND_URL}/auth-success?token=${token}`);
    } catch (error) {
      res.redirect(`${process.env.FRONTEND_URL}/auth-error`);
    }
  }

  @Get('google/mobile-callback')
  async googleMobileCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      if (!code) {
        throw new Error('Authorization code is missing');
      }

      // Обмениваем код на токен через Google
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${process.env.BACKEND_URL}/api/auth/google/mobile-callback`,
        grant_type: 'authorization_code',
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      // Получаем информацию о пользователе
      const userResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${tokenResponse.data.access_token}`,
        },
      });

      const googleUser = userResponse.data;
      const user = await this.authService.validateGoogleUser({
        googleId: googleUser.id,
        email: googleUser.email,
        firstName: googleUser.given_name || googleUser.name?.split(' ')[0] || 'User',
        lastName: googleUser.family_name || googleUser.name?.split(' ')[1] || '',
        picture: googleUser.picture,
      });

      const jwtToken = await this.authService.generateJwtToken(user);
      
      // Перенаправляем в мобильное приложение
      res.redirect(`parsifal://google-callback?token=${jwtToken}&code=${code}&state=${state || ''}`);
    } catch (error) {
      res.redirect(`parsifal://google-callback?error=authentication_failed`);
    }
  }

  @Get('yandex/callback')
  async yandexCallback(
    @Query('code') code: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      if (!code) {
        throw new Error('Authorization code is missing');
      }

      const user = await this.authService.validateYandexUser(code);
      const token = await this.authService.generateJwtToken(user);
      
      // Redirect to frontend with token
      res.redirect(`${process.env.FRONTEND_URL}/auth-success?token=${token}`);
    } catch (error) {
      res.redirect(`${process.env.FRONTEND_URL}/auth-error`);
    }
  }

  @Get('yandex/mobile-callback')
  async yandexMobileCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      if (!code) {
        throw new Error('Authorization code is missing');
      }

      const user = await this.authService.validateYandexUser(code);
      const jwtToken = await this.authService.generateJwtToken(user);
      
      // Перенаправляем в мобильное приложение
      res.redirect(`parsifal://yandex-callback?token=${jwtToken}&code=${code}&state=${state || ''}`);
    } catch (error) {
      res.redirect(`parsifal://yandex-callback?error=authentication_failed`);
    }
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@Req() req: Request): Promise<any> {
    const user = req.user as User;
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      avatar: user.avatar,
      authProvider: user.authProvider,
      providerId: user.providerId,
      isActive: user.isActive,
      roleId: user.roleId,
      role: user.role ? { id: user.role.id, name: user.role.name } : null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  @Get('me')
  @ApiOperation({ summary: 'Получить данные текущего пользователя' })
  @ApiResponse({ status: 200, description: 'Данные пользователя получены успешно' })
  @ApiResponse({ status: 401, description: 'Не авторизован' })
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: Request): Promise<User | null> {
    const user = req.user as User;
    // Возвращаем пользователя в том же формате, что и /users/:id
    // userService.findById уже загружает роль и пермишены
    return this.userService.findById(user.id);
  }

  @Post('google/token')
  async exchangeGoogleCode(@Body() body: { code: string; redirectUri: string }): Promise<any> {
    try {
      const { code, redirectUri } = body;
      
      
      if (!code) {
        throw new Error('Authorization code is missing');
      }

      if (!process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET === 'your-google-client-secret') {
        throw new Error('Google Client Secret не настроен. Пожалуйста, настройте GOOGLE_CLIENT_SECRET в файле .env');
      }

      // Обмениваем код на токен через Google
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return tokenResponse.data;
    } catch (error: any) {
      throw new Error(`Failed to exchange Google authorization code: ${error.response?.data?.error_description || error.message}`);
    }
  }

  @Post('google/userinfo')
  async getGoogleUserInfo(@Body() body: { accessToken: string }): Promise<any> {
    try {
      const { accessToken } = body;
      
      if (!accessToken) {
        throw new Error('Access token is missing');
      }

      // Проверяем, является ли токен JWT (от нашего бэкенда)
      if (accessToken.startsWith('eyJ')) {
        // Это JWT токен от нашего бэкенда, декодируем его
        const user = await this.authService.validateJwtToken(accessToken);
        const userWithPermissions = await this.authService.getUserWithPermissions(user.id);
        
        if (!userWithPermissions) {
          throw new Error('User not found');
        }

        const formattedResponse = this.authService.formatUserResponseWithPermissions(userWithPermissions);
        
        // Получаем список ID пользователей, которым отправлены заявки
        const sentFriendRequestIds = await this.friendRequestService.getSentFriendRequestIds(user.id);
        // Получаем список ID друзей
        const friendIds = await this.friendRequestService.getFriendIds(user.id);
        
        return {
          id: formattedResponse.id,
          email: formattedResponse.email,
          name: formattedResponse.displayName || `${formattedResponse.firstName} ${formattedResponse.lastName}`,
          given_name: formattedResponse.firstName,
          family_name: formattedResponse.lastName,
          picture: formattedResponse.avatar, // Главное фото (первый элемент массива photos)
          photos: formattedResponse.photos || [], // Массив всех фотографий
          verified_email: true,
          locale: 'ru',
          roleId: formattedResponse.roleId,
          isActive: formattedResponse.isActive,
          role: formattedResponse.role,
          permissions: formattedResponse.permissions,
          sentFriendRequestIds,
          friendIds
        };
      } else {
        // Это Google access token, используем новую единую логику
        const user = await this.authService.validateUserByAccessToken(accessToken, 'google');
        const userWithPermissions = await this.authService.getUserWithPermissions(user.id);
        
        if (!userWithPermissions) {
          throw new Error('User not found');
        }

        const jwtToken = await this.authService.generateJwtToken(user);
        
        const formattedResponse = this.authService.formatUserResponseWithPermissions(userWithPermissions);
        
        // Получаем список ID пользователей, которым отправлены заявки
        const sentFriendRequestIds = await this.friendRequestService.getSentFriendRequestIds(user.id);
        // Получаем список ID друзей
        const friendIds = await this.friendRequestService.getFriendIds(user.id);
        
        return {
          id: formattedResponse.id,
          email: formattedResponse.email,
          name: formattedResponse.displayName || `${formattedResponse.firstName} ${formattedResponse.lastName}`,
          given_name: formattedResponse.firstName,
          family_name: formattedResponse.lastName,
          picture: formattedResponse.avatar, // Главное фото (первый элемент массива photos)
          photos: formattedResponse.photos || [], // Массив всех фотографий
          verified_email: true,
          locale: 'ru',
          roleId: formattedResponse.roleId,
          isActive: formattedResponse.isActive,
          role: formattedResponse.role,
          permissions: formattedResponse.permissions,
          jwtToken, // Возвращаем JWT токен для клиента
          sentFriendRequestIds,
          friendIds
        };
      }
    } catch (error: any) {
      throw new Error(`Failed to get Google user info: ${error.message}`);
    }
  }

  @Post('yandex/token')
  async exchangeYandexCode(@Body() body: { code: string; redirectUri: string }): Promise<any> {
    try {
      const { code, redirectUri } = body;
      
      
      if (!code) {
        throw new Error('Authorization code is missing');
      }

      if (!process.env.YANDEX_CLIENT_SECRET || process.env.YANDEX_CLIENT_SECRET === 'your-yandex-client-secret') {
        throw new Error('Yandex Client Secret не настроен. Пожалуйста, настройте YANDEX_CLIENT_SECRET в файле .env');
      }

      if (!process.env.YANDEX_CLIENT_ID || process.env.YANDEX_CLIENT_ID === 'your-yandex-client-id') {
        throw new Error('Yandex Client ID не настроен. Пожалуйста, настройте YANDEX_CLIENT_ID в файле .env');
      }

      // Обмениваем код на токен через Yandex
      const tokenResponse = await axios.post('https://oauth.yandex.ru/token', {
        grant_type: 'authorization_code',
        code,
        client_id: process.env.YANDEX_CLIENT_ID,
        client_secret: process.env.YANDEX_CLIENT_SECRET,
        redirect_uri: redirectUri,
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return tokenResponse.data;
    } catch (error: any) {
      throw new Error(`Failed to exchange Yandex authorization code: ${error.message}`);
    }
  }

  @Get('yandex/status')
  async getYandexStatus(): Promise<any> {
    return {
      message: 'Yandex OAuth настроен и готов к работе',
      clientId: process.env.YANDEX_CLIENT_ID ? 'установлен' : 'не установлен',
      clientSecret: process.env.YANDEX_CLIENT_SECRET ? 'установлен' : 'не установлен',
      callbackUrl: process.env.YANDEX_CALLBACK_URL,
      endpoints: {
        token: 'POST /api/auth/yandex/token',
        userinfo: 'POST /api/auth/yandex/userinfo',
        status: 'GET /api/auth/yandex/status'
      }
    };
  }

  @Post('yandex/userinfo')
  async getYandexUserInfo(@Body() body: { accessToken: string }): Promise<any> {
    try {
      const { accessToken } = body;
      
      if (!accessToken) {
        throw new Error('Access token is missing');
      }

      // Проверяем, является ли токен JWT (от нашего бэкенда)
      if (accessToken.startsWith('eyJ')) {
        // Это JWT токен от нашего бэкенда, декодируем его
        const user = await this.authService.validateJwtToken(accessToken);
        const userWithPermissions = await this.authService.getUserWithPermissions(user.id);
        
        if (!userWithPermissions) {
          throw new Error('User not found');
        }

        const formattedResponse = this.authService.formatUserResponseWithPermissions(userWithPermissions);
        
        // Получаем список ID пользователей, которым отправлены заявки
        const sentFriendRequestIds = await this.friendRequestService.getSentFriendRequestIds(user.id);
        // Получаем список ID друзей
        const friendIds = await this.friendRequestService.getFriendIds(user.id);
        
        return {
          id: formattedResponse.id,
          default_email: formattedResponse.email,
          first_name: formattedResponse.firstName,
          last_name: formattedResponse.lastName,
          display_name: formattedResponse.displayName,
          default_avatar_id: formattedResponse.avatar || undefined,
          photos: formattedResponse.photos || [], // Массив всех фотографий
          real_name: formattedResponse.displayName || `${formattedResponse.firstName} ${formattedResponse.lastName}`,
          login: formattedResponse.email.split('@')[0],
          roleId: formattedResponse.roleId,
          isActive: formattedResponse.isActive,
          role: formattedResponse.role,
          permissions: formattedResponse.permissions,
          sentFriendRequestIds,
          friendIds
        };
      } else {
        // Это Yandex access token, используем новую единую логику
        const user = await this.authService.validateUserByAccessToken(accessToken, 'yandex');
        const userWithPermissions = await this.authService.getUserWithPermissions(user.id);
        
        if (!userWithPermissions) {
          throw new Error('User not found');
        }

        const jwtToken = await this.authService.generateJwtToken(user);
        
        const formattedResponse = this.authService.formatUserResponseWithPermissions(userWithPermissions);
        
        // Получаем список ID пользователей, которым отправлены заявки
        const sentFriendRequestIds = await this.friendRequestService.getSentFriendRequestIds(user.id);
        // Получаем список ID друзей
        const friendIds = await this.friendRequestService.getFriendIds(user.id);
        
        return {
          id: formattedResponse.id,
          default_email: formattedResponse.email,
          first_name: formattedResponse.firstName,
          last_name: formattedResponse.lastName,
          display_name: formattedResponse.displayName,
          default_avatar_id: formattedResponse.avatar || undefined, // Главное фото (первый элемент массива photos)
          photos: formattedResponse.photos || [], // Массив всех фотографий
          real_name: formattedResponse.displayName || `${formattedResponse.firstName} ${formattedResponse.lastName}`,
          login: formattedResponse.email.split('@')[0],
          roleId: formattedResponse.roleId,
          isActive: formattedResponse.isActive,
          role: formattedResponse.role,
          permissions: formattedResponse.permissions,
          jwtToken, // Возвращаем JWT токен для клиента
          sentFriendRequestIds,
          friendIds
        };
      }
    } catch (error) {
      throw new Error('Failed to get Yandex user info');
    }
  }

  @Post('update-from-provider')
  async updateUserFromProvider(@Body() body: { accessToken: string, provider: 'google' | 'yandex' }): Promise<any> {
    try {
      const { accessToken, provider } = body;
      
      if (!accessToken || !provider) {
        throw new Error('Access token and provider are required');
      }

      // Получаем пользователя с обновлением данных
      let user: any;
      
      if (provider === 'google') {
        const response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const normalizedData = this.authService.normalizeGoogleData(response.data);
        user = await this.authService.processOAuthUser(normalizedData, true);
      } else if (provider === 'yandex') {
        const response = await axios.get('https://login.yandex.ru/info', {
          headers: {
            Authorization: `OAuth ${accessToken}`,
          },
        });
        const normalizedData = this.authService.normalizeYandexData(response.data);
        user = await this.authService.processOAuthUser(normalizedData, true);
      } else {
        throw new Error('Unsupported provider');
      }

      const jwtToken = await this.authService.generateJwtToken(user);
      
      // Получаем пользователя с ролями и пермишенами
      const userWithPermissions = await this.authService.getUserWithPermissions(user.id);
      
      if (!userWithPermissions) {
        throw new Error('User not found');
      }

      const formattedResponse = this.authService.formatUserResponseWithPermissions(userWithPermissions);
      
      return {
        id: formattedResponse.id,
        email: formattedResponse.email,
        firstName: formattedResponse.firstName,
        lastName: formattedResponse.lastName,
        displayName: formattedResponse.displayName,
        avatar: formattedResponse.avatar,
        roleId: formattedResponse.roleId,
        isActive: formattedResponse.isActive,
        role: formattedResponse.role,
        permissions: formattedResponse.permissions,
        jwtToken
      };
    } catch (error) {
      throw new Error('Failed to update user from provider');
    }
  }

  // Эндпоинты для локальной аутентификации
  @Post('register')
  @ApiOperation({ summary: 'Регистрация нового пользователя' })
  @ApiResponse({ status: 201, description: 'Пользователь успешно зарегистрирован' })
  @ApiResponse({ status: 400, description: 'Ошибка валидации данных' })
  @ApiBody({ type: RegisterDto })
  async register(@Body(ValidationPipe) registerDto: RegisterDto): Promise<{ user: any; token: string }> {
    const user = await this.authService.register(registerDto);
    const token = await this.authService.generateJwtToken(user);
    
    // Получаем пользователя с ролями и пермишенами
    const userWithPermissions = await this.authService.getUserWithPermissions(user.id);
    
    if (!userWithPermissions) {
      throw new Error('User not found');
    }

    const formattedResponse = this.authService.formatUserResponseWithPermissions(userWithPermissions);
    
    return {
      user: {
        id: formattedResponse.id,
        email: formattedResponse.email,
        firstName: formattedResponse.firstName,
        lastName: formattedResponse.lastName,
        displayName: formattedResponse.displayName,
        avatar: formattedResponse.avatar,
        authProvider: user.authProvider,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        roleId: formattedResponse.roleId,
        role: formattedResponse.role,
        permissions: formattedResponse.permissions
      },
      token,
    };
  }

  @Post('login')
  @ApiOperation({ summary: 'Авторизация пользователя' })
  @ApiResponse({ status: 200, description: 'Успешная авторизация' })
  @ApiResponse({ status: 401, description: 'Неверные учетные данные' })
  @ApiBody({ 
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@example.com' },
        password: { type: 'string', example: 'password123' }
      },
      required: ['email', 'password']
    }
  })
  @UseGuards(AuthGuard('local'))
  async login(@Req() req: Request): Promise<{ user: any; token: string }> {
    const user = req.user as any;
    const token = await this.authService.generateJwtToken(user);
    
    // Получаем пользователя с ролями и пермишенами
    const userWithPermissions = await this.authService.getUserWithPermissions(user.id);
    
    if (!userWithPermissions) {
      throw new Error('User not found');
    }

    const formattedResponse = this.authService.formatUserResponseWithPermissions(userWithPermissions);
    
    return {
      user: {
        id: formattedResponse.id,
        email: formattedResponse.email,
        firstName: formattedResponse.firstName,
        lastName: formattedResponse.lastName,
        displayName: formattedResponse.displayName,
        avatar: formattedResponse.avatar,
        authProvider: user.authProvider,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        roleId: formattedResponse.roleId,
        role: formattedResponse.role,
        permissions: formattedResponse.permissions
      },
      token,
    };
  }

  // Эндпоинт для восстановления пароля
  @Post('forgot-password')
  @ApiOperation({ summary: 'Запрос восстановления пароля' })
  @ApiResponse({ status: 200, description: 'Письмо с инструкциями отправлено' })
  @ApiResponse({ status: 404, description: 'Пользователь не найден' })
  @ApiBody({ type: ForgotPasswordDto })
  async forgotPassword(@Body(ValidationPipe) forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    return await this.authService.forgotPassword(forgotPasswordDto.email);
  }

  // Эндпоинт для сброса пароля по токену
  @Post('reset-password')
  @ApiOperation({ summary: 'Сброс пароля по токену' })
  @ApiResponse({ status: 200, description: 'Пароль успешно изменен' })
  @ApiResponse({ status: 400, description: 'Неверный или истекший токен' })
  @ApiBody({ type: ResetPasswordDto })
  async resetPassword(@Body(ValidationPipe) resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    return await this.authService.resetPassword(resetPasswordDto.token, resetPasswordDto.newPassword);
  }

  // Эндпоинт для генерации случайного пароля
  @Get('generate-password')
  async generatePassword(@Query('length') length?: string): Promise<{ password: string; passwords?: string[] }> {
    const passwordLength = length ? parseInt(length, 10) : 12;
    
    if (passwordLength < 8 || passwordLength > 50) {
      throw new Error('Длина пароля должна быть от 8 до 50 символов');
    }

    const password = this.passwordGeneratorService.generatePassword(passwordLength);
    const passwords = this.passwordGeneratorService.generateMultiplePasswords(3, passwordLength);
    
    return {
      password,
      passwords
    };
  }

  // Эндпоинт для тестирования email сервиса (только для разработки)
  @Get('test-email')
  async testEmail(): Promise<{ message: string; success: boolean }> {
    try {
      const isWorking = await this.emailNewService.testEmailConnection();
      
      if (isWorking) {
        return { message: '✅ Email сервис настроен правильно', success: true };
      } else {
        return { message: '❌ Ошибка подключения к email сервису', success: false };
      }
    } catch (error: any) {
      return { message: `❌ Ошибка: ${error.message || 'Неизвестная ошибка'}`, success: false };
    }
  }

  // Эндпоинт для получения всех пользователей (для админ панели)
  // Временно без авторизации для тестирования
  @Get('users')
  async getAllUsers(): Promise<any[]> {
    const users = await this.userService.findAll();
    
    // Возвращаем пользователей в формате, ожидаемом фронтендом
    return users.map(user => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      provider: user.authProvider || 'local',
      roleId: user.roleId,
      role: user.role ? { id: user.role.id, name: user.role.name } : null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));
  }

  // Эндпоинт для получения пользователей с фильтрацией через query параметры
  @Get('users/filter')
  async getUsersWithFilter(@FilterQuery() filterRequest: FilterRequestDto): Promise<any> {
    const result = await this.userService.findAllWithFilters(filterRequest);
    
    // Возвращаем пользователей в формате, ожидаемом фронтендом
    const users = result.data.map(user => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      avatar: user.avatar,
      provider: user.authProvider || 'local',
      roleId: user.roleId,
      role: user.role ? { id: user.role.id, name: user.role.name } : null,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));

    return {
      data: users,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages
    };
  }

  // Эндпоинт для получения пользователей с фильтрацией через POST запрос
  @Post('users/search')
  async searchUsers(@FilterBody() filterRequest: FilterRequestDto): Promise<any> {
    const result = await this.userService.findAllWithFilters(filterRequest);
    
    // Возвращаем пользователей в формате, ожидаемом фронтендом
    const users = result.data.map(user => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      avatar: user.avatar,
      provider: user.authProvider || 'local',
      roleId: user.roleId,
      role: user.role ? { id: user.role.id, name: user.role.name } : null,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));

    return {
      data: users,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages
    };
  }

  // Временный эндпоинт для получения ролей
  @Get('roles')
  async getRoles(): Promise<any[]> {
    // Получаем уникальные роли из пользователей
    const users = await this.userService.findAll();
    const uniqueRoles = users
      .filter(user => user.role)
      .map(user => ({
        id: user.role!.id,
        name: user.role!.name,
        description: user.role!.description || '',
        createdAt: user.role!.createdAt,
        updatedAt: user.role!.updatedAt
      }))
      .filter((role, index, self) => 
        index === self.findIndex(r => r.id === role.id)
      );
    
    return uniqueRoles;
  }

}