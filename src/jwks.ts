import { JWKS_URL, JWKS_CACHE_TTL_MS } from "./config";
import { importEd25519VerifyKey } from "./crypto";
import { fetchWithTimeout } from "./http";
import { VerifyYouError } from "./errors";

// The DOM JsonWebKey type omits `kid`, which JWKS entries carry.
type Jwk = JsonWebKey & { kid?: string };

// kid -> imported verify key. Replaced wholesale on each refresh.
let cache = new Map<string, CryptoKey>();
let fetchedAt = 0;

async function refreshJwks(): Promise<void> {
  const res = await fetchWithTimeout(JWKS_URL, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new VerifyYouError(
      `JWKS fetch failed: HTTP ${res.status}`,
      "jwks_unavailable",
      res.status,
    );
  }

  let doc: { keys?: Jwk[] };
  try {
    doc = (await res.json()) as { keys?: Jwk[] };
  } catch {
    throw new VerifyYouError("JWKS was not valid JSON", "jwks_unavailable");
  }

  const next = new Map<string, CryptoKey>();
  for (const jwk of doc.keys ?? []) {
    // Only Ed25519 keys with a kid are usable for our tokens.
    if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || !jwk.kid) continue;
    try {
      next.set(jwk.kid, await importEd25519VerifyKey(jwk));
    } catch {
      // Skip an individual unusable key rather than failing the whole set.
    }
  }

  cache = next;
  fetchedAt = Date.now();
}

/**
 * Resolve the verify key for `kid`, fetching the JWKS if the cache is stale or
 * the kid is unknown (which covers key rotation). Throws if it still can't be
 * found after a fresh fetch.
 */
export async function getVerificationKey(kid: string): Promise<CryptoKey> {
  const fresh = Date.now() - fetchedAt < JWKS_CACHE_TTL_MS;
  if (!fresh || !cache.has(kid)) {
    await refreshJwks();
  }
  const key = cache.get(kid);
  if (!key) {
    throw new VerifyYouError(`no JWKS key for kid "${kid}"`, "unknown_kid");
  }
  return key;
}

/** Clear the in-memory JWKS cache (primarily for tests). */
export function resetJwksCache(): void {
  cache = new Map();
  fetchedAt = 0;
}
