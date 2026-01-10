import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../auth.service';
import { UserService } from '../../user/user.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private userService: UserService
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<any> {
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException('Invalid token payload');
    }
    
    // Загружаем полные данные пользователя из базы данных с ролью и пермишенами
    const user = await this.userService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    
    // Проверяем, не заблокирован ли пользователь
    const isBlocked = await this.userService.checkIfBlocked(user.id);
    if (isBlocked) {
      throw new UnauthorizedException('Ваш аккаунт заблокирован. Обратитесь к администратору.');
    }
    
    // Если у пользователя есть роль, загружаем её с пермишенами
    if (user.roleId) {
      const userWithRole = await this.userService.findById(payload.sub);
      if (userWithRole && userWithRole.role) {
        return userWithRole;
      }
    }
    
    return user;
  }
}
