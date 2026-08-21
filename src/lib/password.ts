import { compare, hash } from "bcryptjs";

/**
 * The bcrypt cost factor every stored password is hashed at.
 *
 * Kept in one place because the value has to match everywhere a password is
 * written — registration, password reset, changing it from the profile — and a
 * copy that drifted would quietly produce weaker hashes for one of those paths.
 * `prisma/seed.ts` keeps its own copy, since scripts run outside the app.
 */
export const BCRYPT_ROUNDS = 12;

/** Hashes a plaintext password for storage. */
export function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_ROUNDS);
}

/**
 * Checks a plaintext password against a stored hash.
 *
 * bcrypt's own comparison is constant-time for a given hash, so this does not
 * leak how much of the password was right.
 */
export function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return compare(password, passwordHash);
}
