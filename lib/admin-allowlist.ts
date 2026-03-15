/**
 * Admin email allowlist for Michaeli Motors Auction.
 * Only these emails can access admin functionality.
 * Enforced both client-side (layout) and server-side (API routes + Cloud Functions).
 */
export const ADMIN_EMAILS: readonly string[] = [
  'ceo@m-motors.co.il',
  'office@m-motors.co.il',
] as const;

/**
 * Check if an email is in the admin allowlist.
 * Case-insensitive comparison.
 */
export function isAllowedAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
}
