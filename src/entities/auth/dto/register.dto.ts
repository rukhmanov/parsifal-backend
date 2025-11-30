import { IsEmail, IsNotEmpty, IsString, IsOptional, IsDateString, IsIn, IsBoolean } from 'class-validator';
import { IsStrongPassword } from '../../../common/validators/password.validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Некорректный email адрес' })
  @IsNotEmpty({ message: 'Email обязателен' })
  email!: string;

  @IsString({ message: 'Пароль должен быть строкой' })
  @IsNotEmpty({ message: 'Пароль обязателен' })
  @IsStrongPassword()
  password!: string;

  @IsString({ message: 'Имя должно быть строкой' })
  @IsNotEmpty({ message: 'Имя обязательно' })
  firstName!: string;

  @IsString({ message: 'Фамилия должна быть строкой' })
  @IsNotEmpty({ message: 'Фамилия обязательна' })
  lastName!: string;

  @IsOptional()
  @IsIn(['male', 'female'], { message: 'Пол должен быть male или female' })
  gender?: 'male' | 'female';

  @IsOptional()
  @IsDateString({}, { message: 'Некорректная дата рождения' })
  birthDate?: string;

  @IsBoolean({ message: 'Необходимо принять Условия использования' })
  @IsNotEmpty({ message: 'Необходимо принять Условия использования' })
  acceptTerms!: boolean;

  @IsBoolean({ message: 'Необходимо принять Политику конфиденциальности' })
  @IsNotEmpty({ message: 'Необходимо принять Политику конфиденциальности' })
  acceptPrivacy!: boolean;
}
