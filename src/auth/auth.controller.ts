import { Controller, Get, Post, Query, Req, Res, UseGuards, Body } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
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
    } catch (error) {
      console.error('Ошибка обмена кода Google:', error);
      throw new Error('Failed to exchange Google authorization code');
    }
  }

  @Post('google/userinfo')
  async getGoogleUserInfo(@Body() body: { accessToken: string }): Promise<any> {
    try {
      const { accessToken } = body;
      
      if (!accessToken) {
        throw new Error('Access token is missing');
      }

      // Получаем информацию о пользователе через Google API
      const userResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return userResponse.data;
    } catch (error) {
      console.error('Ошибка получения информации о пользователе Google:', error);
      throw new Error('Failed to get Google user info');
    }
  }

  @Post('yandex/token')
  async exchangeYandexCode(@Body() body: { code: string; redirectUri: string }): Promise<any> {
    try {
      const { code, redirectUri } = body;
      
      if (!code) {
        throw new Error('Authorization code is missing');
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
    } catch (error) {
      console.error('Ошибка обмена кода Yandex:', error);
      throw new Error('Failed to exchange Yandex authorization code');
    }
  }

  @Post('yandex/userinfo')
  async getYandexUserInfo(@Body() body: { accessToken: string }): Promise<any> {
    try {
      const { accessToken } = body;
      
      if (!accessToken) {
        throw new Error('Access token is missing');
      }

      // Получаем информацию о пользователе через Yandex API
      const userResponse = await axios.get('https://login.yandex.ru/info', {
        headers: {
          Authorization: `OAuth ${accessToken}`,
        },
      });

      return userResponse.data;
    } catch (error) {
      console.error('Ошибка получения информации о пользователе Yandex:', error);
      throw new Error('Failed to get Yandex user info');
    }
  }
}