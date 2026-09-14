import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function key(): Buffer {
  const value = process.env.WRAPP_CREDENTIALS_ENCRYPTION_KEY;
  if (!value) throw new Error("WRAPP_CREDENTIALS_ENCRYPTION_KEY is not configured");

  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== 32) {
    throw new Error("WRAPP_CREDENTIALS_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  return decoded;
}

export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return ["v1", iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".");
}

export function verifyWrappWebhook(rawBody: Buffer, signature?: string): boolean {
  const partnerKey = process.env.WRAPP_PARTNER_API_KEY;
  if (!partnerKey || !signature) return false;

  const expected = crypto.createHmac("sha256", partnerKey).update(rawBody).digest("hex");
  const received = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  return received.length === expectedBuffer.length &&
    crypto.timingSafeEqual(received, expectedBuffer);
}
