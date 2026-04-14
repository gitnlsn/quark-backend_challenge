import { describe, it, expect } from 'vitest';
import { isValidCnpj } from './cnpj.util.js';

describe('isValidCnpj', () => {
  it('should accept a valid CNPJ', () => {
    // 11.222.333/0001-81 is a well-known valid CNPJ
    expect(isValidCnpj('11222333000181')).toBe(true);
  });

  it('should accept a valid CNPJ with formatting', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
  });

  it('should reject an all-zeros CNPJ', () => {
    expect(isValidCnpj('00000000000000')).toBe(false);
  });

  it('should reject all-same-digit CNPJs', () => {
    expect(isValidCnpj('11111111111111')).toBe(false);
    expect(isValidCnpj('99999999999999')).toBe(false);
  });

  it('should reject a CNPJ with invalid check digits', () => {
    expect(isValidCnpj('11222333000182')).toBe(false);
  });

  it('should reject a CNPJ with wrong length', () => {
    expect(isValidCnpj('1122233300018')).toBe(false);
    expect(isValidCnpj('112223330001811')).toBe(false);
  });

  it('should reject an empty string', () => {
    expect(isValidCnpj('')).toBe(false);
  });

  it('should accept another known valid CNPJ', () => {
    // 12.345.678/0001-95
    expect(isValidCnpj('12345678000195')).toBe(true);
  });
});
