import { IsNotEmpty, IsString } from 'class-validator';
import { IsStrongPassword } from '../../../common/validators/password.validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @IsNotEmpty()
  @IsStrongPassword()
  newPassword!: string;
}
