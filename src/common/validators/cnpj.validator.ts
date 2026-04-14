import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isValidCnpj } from '../utils/cnpj.util.js';

@ValidatorConstraint({ name: 'isCnpj', async: false })
export class IsCnpjConstraint implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    if (typeof value !== 'string') return false;
    return isValidCnpj(value);
  }

  defaultMessage(): string {
    return 'companyCnpj must be a valid CNPJ (14 digits with valid check digits)';
  }
}

export function IsCnpj(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsCnpjConstraint,
    });
  };
}
