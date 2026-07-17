import crypto from "crypto";

/**
 * AES-256-GCM helpers used to encrypt Microsoft Graph tokens at rest.
 * TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.
 */

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY ist nicht gesetzt. Bitte in der .env-Datei konfigurieren."
    );
  }
  const buffer = Buffer.from(key, "base64");
  if (buffer.length !== 32) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY muss ein base64-kodierter 32-Byte-Schlüssel sein."
    );
  }
  return buffer;
}

export function encrypt(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(
    "."
  );
}

export function decrypt(cipherText: string): string {
  const [ivB64, authTagB64, dataB64] = cipherText.split(".");
  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error("Ungültiges Chiffretext-Format.");
  }
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}
