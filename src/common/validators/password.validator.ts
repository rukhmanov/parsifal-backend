import { registerDecorator, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';

@ValidatorConstraint({ name: 'isStrongPassword', async: false })
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(password: string, _args: ValidationArguments) {
    if (!password) return false;

    // Минимум 8 символов
    if (password.length < 8) return false;

    // Должна содержать хотя бы одну заглавную букву
    if (!/[A-Z]/.test(password)) return false;

    // Должна содержать хотя бы одну строчную букву
    if (!/[a-z]/.test(password)) return false;

    // Должна содержать хотя бы одну цифру
    if (!/\d/.test(password)) return false;

    // Должна содержать хотя бы один специальный символ
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return false;

    return true;
  }

  defaultMessage(_args: ValidationArguments) {
    return 'Пароль должен содержать минимум 8 символов, включая заглавные и строчные буквы, цифры и специальные символы';
  }
}

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsStrongPasswordConstraint,
    });
  };
}
