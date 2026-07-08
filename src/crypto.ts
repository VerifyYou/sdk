export function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function b64urlToString(s: string): string {
  return new TextDecoder().decode(b64urlToBytes(s));
}

/** Import an Ed25519 public JWK as a verify-only WebCrypto key. */
export function importEd25519VerifyKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, [
    "verify",
  ]);
}

export function verifyEd25519(
  key: CryptoKey,
  signingInput: string,
  sig: Uint8Array<ArrayBuffer>,
): Promise<boolean> {
  return crypto.subtle.verify(
    { name: "Ed25519" },
    key,
    sig,
    new TextEncoder().encode(signingInput),
  );
}
