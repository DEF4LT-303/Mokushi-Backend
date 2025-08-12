import { createHash } from 'crypto';

/**
 * Hashes a token string using SHA-256 and returns hex digest
 */
export function hashToken(token: string): string {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token provided for hashing');
  }
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Parses a JWT expiry string (e.g., '7d', '15m', '1h') into a Date object
 * Throws error if format is unsupported or invalid
 */
export function parseExpiryToDate(expiry: string): Date {
  if (!expiry || typeof expiry !== 'string') {
    throw new Error('Expiry must be a non-empty string');
  }

  const now = new Date();
  const num = parseInt(expiry, 10);

  if (isNaN(num)) {
    throw new Error(`Invalid number in expiry string: ${expiry}`);
  }

  if (expiry.endsWith('d')) {
    now.setDate(now.getDate() + num);
  } else if (expiry.endsWith('h')) {
    now.setHours(now.getHours() + num);
  } else if (expiry.endsWith('m')) {
    now.setMinutes(now.getMinutes() + num);
  } else if (expiry.endsWith('s')) {
    now.setSeconds(now.getSeconds() + num);
  } else {
    throw new Error(`Unsupported expiry format: ${expiry}`);
  }

  return now;
}
