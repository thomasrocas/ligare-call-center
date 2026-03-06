/**
 * Field-level encryption for sensitive PHI data (SSN, insurance IDs, etc.)
 * Uses AES-256-GCM with a per-field salt for HIPAA compliance.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256-bit key
const IV_LENGTH = 16;  // 128-bit IV
const AUTH_TAG_LENGTH = 16; // GCM auth tag
const SALT_LENGTH = 32;

function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return scryptSync(masterKey, salt, KEY_LENGTH) as Buffer;
}

/**
 * Encrypt a plaintext string. Returns a base64 encoded payload:
 * salt(32) + iv(16) + authTag(16) + ciphertext
 */
export function encrypt(plaintext: string, masterKey?: string): string {
  const key = masterKey || process.env.ENCRYPTION_KEY || 'ligare-dev-encryption-key-change-in-prod';
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = deriveKey(key, salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const payload = Buffer.concat([salt, iv, authTag, encrypted]);
  return payload.toString('base64');
}

/**
 * Decrypt a base64 encoded payload back to plaintext.
 */
export function decrypt(encryptedB64: string, masterKey?: string): string {
  const key = masterKey || process.env.ENCRYPTION_KEY || 'ligare-dev-encryption-key-change-in-prod';
  const payload = Buffer.from(encryptedB64, 'base64');

  const salt = payload.subarray(0, SALT_LENGTH);
  const iv = payload.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = payload.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  const derivedKey = deriveKey(key, salt);
  const decipher = createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(authTag);

  return decipher.update(ciphertext) + decipher.final('utf8');
}

/**
 * Mask a value for display (show only last 4 chars)
 */
export function maskSensitive(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length < 4) return '****';
  return '*'.repeat(value.length - 4) + value.slice(-4);
}
