import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const TOKEN_PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

export function encryptSessionToken(value: string, secret: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, tokenKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${TOKEN_PREFIX}${encode(iv)}.${encode(tag)}.${encode(ciphertext)}`;
}

export function decryptSessionToken(value: string, secret: string): string {
  if (!value.startsWith(TOKEN_PREFIX)) return value;
  const [iv, tag, ciphertext] = value.slice(TOKEN_PREFIX.length).split(".").map(decode);
  if (!iv || !tag || !ciphertext) throw new Error("Invalid encrypted session token");

  const decipher = createDecipheriv(ALGORITHM, tokenKey(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function getSessionTokenSecret(env: NodeJS.ProcessEnv): string {
  const secret = env.CONTROLS_TOKEN_ENCRYPTION_SECRET ?? env.CONTROLS_SESSION_SECRET;
  if (!secret) throw new Error("Missing controls token encryption secret");
  return secret;
}

function tokenKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

function encode(value: Buffer): string {
  return value.toString("base64url");
}

function decode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}
