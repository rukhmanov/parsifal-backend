import { Controller, Get, Post, Query, Req, Res, UseGuards, Body, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import axios from 'axios';

export interface GoogleCallbackRequest extends Request {
  user: any;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@Req() req: Request): Promise<any> {
    return req.user;
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
      console.error('Google token exchange error:', error.response?.data || error.message);
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
        return {
          id: user.id,
          email: user.email,
          name: user.displayName || `${user.firstName} ${user.lastName}`,
          given_name: user.firstName,
          family_name: user.lastName,
          picture: user.avatar,
          verified_email: true,
          locale: 'ru'
        };
      } else {
        // Это Google access token, используем новую единую логику
        const user = await this.authService.validateUserByAccessToken(accessToken, 'google');
        const jwtToken = await this.authService.generateJwtToken(user);
        
        return {
          id: user.id,
          email: user.email,
          name: user.displayName || `${user.firstName} ${user.lastName}`,
          given_name: user.firstName,
          family_name: user.lastName,
          picture: user.avatar,
          verified_email: true,
          locale: 'ru',
          jwtToken // Возвращаем JWT токен для клиента
        };
      }
    } catch (error: any) {
      console.error('Error in getGoogleUserInfo:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data,
        status: error.response?.status
      });
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
      throw new Error('Failed to exchange Yandex authorization code');
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
        return {
          id: user.id,
          default_email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          display_name: user.displayName,
          default_avatar_id: user.avatar ? user.avatar.split('/').pop() : undefined,
          real_name: user.displayName || `${user.firstName} ${user.lastName}`,
          login: user.email.split('@')[0]
        };
      } else {
        // Это Yandex access token, используем новую единую логику
        const user = await this.authService.validateUserByAccessToken(accessToken, 'yandex');
        const jwtToken = await this.authService.generateJwtToken(user);
        
        return {
          id: user.id,
          default_email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          display_name: user.displayName,
          default_avatar_id: user.avatar ? user.avatar.split('/').pop() : undefined,
          real_name: user.displayName || `${user.firstName} ${user.lastName}`,
          login: user.email.split('@')[0],
          jwtToken // Возвращаем JWT токен для клиента
        };
      }
    } catch (error) {
      throw new Error('Failed to get Yandex user info');
    }
  }

  // Эндпоинты для локальной аутентификации
  @Post('register')
  async register(@Body(ValidationPipe) registerDto: RegisterDto): Promise<{ user: any; token: string }> {
    const user = await this.authService.register(registerDto);
    const token = await this.authService.generateJwtToken(user);
    
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        avatar: user.avatar,
        authProvider: user.authProvider,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      token,
    };
  }

  @Post('login')
  @UseGuards(AuthGuard('local'))
  async login(@Req() req: Request): Promise<{ user: any; token: string }> {
    const user = req.user as any;
    const token = await this.authService.generateJwtToken(user);
    
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        avatar: user.avatar,
        authProvider: user.authProvider,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      token,
    };
  }
}