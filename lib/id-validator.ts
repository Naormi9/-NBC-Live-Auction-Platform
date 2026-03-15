/**
 * Israeli ID number (ת"ז) validation using the Luhn-like algorithm.
 * ID must be exactly 9 digits. Leading zeros are padded if needed.
 */
export function validateIsraeliId(id: string): boolean {
  // Remove spaces/dashes
  const cleaned = id.replace(/[\s-]/g, '');

  // Must be 1-9 digits
  if (!/^\d{1,9}$/.test(cleaned)) return false;

  // Pad to 9 digits
  const padded = cleaned.padStart(9, '0');

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let digit = parseInt(padded[i], 10);
    // Multiply even-index digits by 1, odd-index by 2
    digit *= (i % 2) + 1;
    if (digit > 9) digit -= 9;
    sum += digit;
  }

  return sum % 10 === 0;
}

/**
 * Format Israeli ID for display (with leading zeros).
 */
export function formatIsraeliId(id: string): string {
  return id.replace(/[\s-]/g, '').padStart(9, '0');
}
