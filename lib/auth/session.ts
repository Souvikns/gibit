// Web Crypto only, so this works in proxy.ts and in server code alike.

export const SESSION_COOKIE = "gibit_session";
export const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60;
const RENEW_BELOW_MS = 15 * 24 * 60 * 60 * 1000;

const encoder = new TextEncoder();

async function sessionKey(password: string): Promise<CryptoKey> {
  const material = await crypto.subtle.digest("SHA-256", encoder.encode(`gibit-session:${password}`));
  return crypto.subtle.importKey("raw", material, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  try {
    return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

export async function signSession(password: string, expiresAt: number): Promise<string> {
  const signature = await crypto.subtle.sign("HMAC", await sessionKey(password), encoder.encode(String(expiresAt)));
  return `${expiresAt}.${toBase64Url(signature)}`;
}

export async function verifySession(
  password: string,
  token: string,
  now: number = Date.now(),
): Promise<{ valid: true; expiresAt: number } | { valid: false }> {
  const [expiresRaw, signatureRaw, extra] = token.split(".");
  if (!expiresRaw || !signatureRaw || extra !== undefined || !/^\d+$/.test(expiresRaw)) return { valid: false };
  const expiresAt = Number(expiresRaw);
  if (expiresAt <= now) return { valid: false };
  const signature = fromBase64Url(signatureRaw);
  if (!signature) return { valid: false };
  const ok = await crypto.subtle.verify("HMAC", await sessionKey(password), signature, encoder.encode(expiresRaw));
  return ok ? { valid: true, expiresAt } : { valid: false };
}

export function shouldRenew(expiresAt: number, now: number = Date.now()): boolean {
  return expiresAt - now < RENEW_BELOW_MS;
}

/** Constant-time string comparison (compares fixed-length digests). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const x = new Uint8Array(da);
  const y = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Only same-origin absolute paths; anything else falls back to "/". */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
