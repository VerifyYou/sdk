export type VerifyYouErrorCode =
  | "timeout"
  | "network"
  | "http"
  | "jwks_unavailable" // couldn't fetch/parse the JWKS
  | "unknown_kid" // token's kid isn't in the JWKS (even after refresh)
  | "bad_token" // token malformed / wrong alg / missing kid
  | "bad_signature" // signature didn't verify against the key
  | "expired" // token exp/nbf check failed
  | "bad_response"; // API response wasn't valid JSON

export class VerifyYouError extends Error {
  constructor(
    message: string,
    readonly code: VerifyYouErrorCode,
    readonly status?: number,
  ) {
    super(message);
    this.name = "VerifyYouError";
  }
}
