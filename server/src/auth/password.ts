import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function hashPassword(password: string): string {
   const salt = randomBytes(16).toString('hex');
   const hash = scryptSync(password, salt, 64).toString('hex');
   return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
   const [salt, hash] = stored.split(':');
   const attempt = scryptSync(password, salt, 64);
   return timingSafeEqual(attempt, Buffer.from(hash, 'hex'));
}
