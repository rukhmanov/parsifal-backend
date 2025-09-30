import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';

export interface YandexUserInfo {
  id: string;
  login: string;
  client_id: string;
  display_name: string;
  real_name: string;
  first_name: string;
  last_name: string;
  sex: string;
  default_email: string;
  emails: string[];
  default_avatar_id: string;
  is_avatar_empty: boolean;
  psuid: string;
  birthday?: string;
  default_phone?: {
    id: number;
    number: string;
  };
}

export interface YandexTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

@Injectable()
export class YandexStrategy {
  constructor(private readonly configService: ConfigService) {}

  getClientId(): string {
    const clientId = this.configService.get<string>('YANDEX_CLIENT_ID');
    if (!clientId) {
      throw new Error('YANDEX_CLIENT_ID is not configured');
    }
    return clientId;
  }

  getClientSecret(): string {
    const clientSecret = this.configService.get<string>('YANDEX_CLIENT_SECRET');
    if (!clientSecret) {
      throw new Error('YANDEX_CLIENT_SECRET is not configured');
    }
    return clientSecret;
  }

  getCallbackUrl(): string {
    const callbackUrl = this.configService.get<string>('YANDEX_CALLBACK_URL');
    if (!callbackUrl) {
      throw new Error('YANDEX_CALLBACK_URL is not configured');
    }
    return callbackUrl;
  }

  async exchangeCodeForToken(code: string): Promise<YandexTokenResponse> {
    const tokenUrl = 'https://oauth.yandex.ru/token';
    
    const response: AxiosResponse<YandexTokenResponse> = await axios.post(
      tokenUrl,
      {
        grant_type: 'authorization_code',
        code,
        client_id: this.getClientId(),
        client_secret: this.getClientSecret(),
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    return response.data;
  }

  async getUserInfo(accessToken: string): Promise<YandexUserInfo> {
    const userInfoUrl = 'https://login.yandex.ru/info';
    
    const response: AxiosResponse<YandexUserInfo> = await axios.get(
      userInfoUrl,
      {
        headers: {
          Authorization: `OAuth ${accessToken}`,
        },
      },
    );

    return response.data;
  }
}
