import { TOKEN_PARAM } from "./config";
import { b64urlToBytes, b64urlToString, verifyEd25519 } from "./crypto";
import { getVerificationKey } from "./jwks";
import { VerifyYouError } from "./errors";

export type TokenPayload = Record<string, unknown> & {
  exp?: number; // expiry (seconds since epoch)
  nbf?: number; // not-before (seconds since epoch)
  iat?: number; // issued-at (seconds since epoch)
};

/**
 * Read the signed token from a URL's query string. Defaults to the current
 * page URL; pass a string/URL to parse a specific one. Returns null if absent.
 */
export function readTokenFromUrl(source?: string | URL): string | null {
  let url: URL;
  try {
    url = source != null ? new URL(source.toString()) : new URL(location.href);
  } catch {
    return null;
  }
  return url.searchParams.get(TOKEN_PARAM);
}

/**
 * Verify a compact EdDSA JWT against the well-known JWKS and return its
 * payload. Throws VerifyYouError on any malformed/invalid/expired token.
 */
export async function verifyToken(token: string): Promise<TokenPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new VerifyYouError("token is not a compact JWT", "bad_token");
  }
  const [h, p, s] = parts as [string, string, string];

  let header: { alg?: string; kid?: string };
  try {
    header = JSON.parse(b64urlToString(h));
  } catch {
    throw new VerifyYouError("token header is not valid JSON", "bad_token");
  }
  if (header.alg !== "EdDSA") {
    throw new VerifyYouError(`unexpected token alg "${header.alg}"`, "bad_token");
  }
  if (!header.kid) {
    throw new VerifyYouError("token header missing kid", "bad_token");
  }

  const key = await getVerificationKey(header.kid);
  const ok = await verifyEd25519(key, `${h}.${p}`, b64urlToBytes(s));
  if (!ok) {
    throw new VerifyYouError("token signature invalid", "bad_signature");
  }

  let payload: TokenPayload;
  try {
    payload = JSON.parse(b64urlToString(p));
  } catch {
    throw new VerifyYouError("token payload is not valid JSON", "bad_token");
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && now >= payload.exp) {
    throw new VerifyYouError("token expired", "expired");
  }
  if (typeof payload.nbf === "number" && now < payload.nbf) {
    throw new VerifyYouError("token not yet valid", "expired");
  }

  return payload;
}
