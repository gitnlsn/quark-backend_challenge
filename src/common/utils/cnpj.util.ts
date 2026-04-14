const FIRST_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const SECOND_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function computeDigit(digits: number[], weights: number[]): number {
  const sum = weights.reduce((acc, w, i) => acc + w * digits[i], 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCnpj(value: string): boolean {
  const cleaned = value.replace(/\D/g, '');

  if (cleaned.length !== 14) return false;

  // Reject all-same-digit CNPJs (e.g., 00000000000000)
  if (/^(\d)\1{13}$/.test(cleaned)) return false;

  const digits = cleaned.split('').map(Number);

  const firstDigit = computeDigit(digits.slice(0, 12), FIRST_WEIGHTS);
  if (digits[12] !== firstDigit) return false;

  const secondDigit = computeDigit(digits.slice(0, 13), SECOND_WEIGHTS);
  if (digits[13] !== secondDigit) return false;

  return true;
}
