import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const secret =
    process.env.SECRET_KEY ||
    process.env.ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    process.env.COOKIE_SECRET;

  if (!secret) {
    throw new Error("SECRET_KEY/ENCRYPTION_KEY/JWT_SECRET not configured for crypto.util");
  }
  // Derive 32 bytes key
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(value: string): string {
  if (!value) return value;
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptSecret(payload: string): string {
  if (!payload) return payload;
  
  try {
    const buffer = Buffer.from(payload, "base64");
    
    // Verificar se o buffer tem tamanho mínimo esperado (iv + authTag + pelo menos 1 byte)
    const minLength = IV_LENGTH + AUTH_TAG_LENGTH + 1;
    if (buffer.length < minLength) {
      // Valor não está criptografado ou está malformado - retornar como está
      console.warn('[Crypto] Value too short to be encrypted, returning as-is');
      return payload;
    }
    
    const iv = buffer.subarray(0, IV_LENGTH);
    const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const data = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    
    // Verificar se authTag tem o tamanho correto
    if (authTag.length !== AUTH_TAG_LENGTH) {
      console.warn('[Crypto] Invalid authTag length, returning as-is');
      return payload;
    }
    
    const key = getKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (error: any) {
    // Se falhar a decriptação, o valor provavelmente não está criptografado
    console.warn('[Crypto] Decryption failed, returning value as-is:', error.message);
    return payload;
  }
}
