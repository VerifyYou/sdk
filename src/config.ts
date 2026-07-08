/**
 * Static SDK configuration.
 *
 * Responses are authenticated with an EdDSA-signed token that arrives as a URL
 * query param; the verifying key is fetched from a well-known JWKS endpoint and
 * selected by `kid`. So there is no API key and no runtime `configure()` step —
 * everything here is baked in at build time (overridable via Vite env vars).
 *
 * ASSUMPTIONS TO CONFIRM against the real API — change here if they differ:
 *   1. The signed token arrives in the `vy_token` query param (TOKEN_PARAM).
 *   2. The JWKS lives at `/.well-known/jwks.json` under the API origin (JWKS_URL).
 *      As of 2026-07 NO deployed service publishes a JWKS — api.verifyyou.io
 *      404s and neither connect nor app serve one — so `verifyToken()` cannot
 *      succeed against prod until that endpoint ships. The documented flow
 *      (`vyt` + `GET /v3/confirmations/{token}`) doesn't use it.
 *   3. The token is a compact EdDSA JWT with `kid` in its header — this one is
 *      enforced (and documented) in token.ts, not configurable here.
 */

/** API origin. Override at build time with `VITE_VERIFYYOU_API_BASE`. */
export const API_BASE: string =
  import.meta.env.VITE_VERIFYYOU_API_BASE ?? "https://api.verifyyou.io";

/**
 * Connect-service origin the SDK calls to start a flow from a publishable key
 * (`POST /v3/initialize`). The default is production — this is what ships in
 * the npm artifact. For local dev set `VITE_VERIFYYOU_CONNECT_BASE` (e.g.
 * http://localhost:8090) or pass `connectBase` to init(). The app-fe origin
 * used for the iframe + postMessage check is derived from the URL that
 * endpoint returns, so it is not configured here.
 */
export const CONNECT_BASE: string =
  import.meta.env.VITE_VERIFYYOU_CONNECT_BASE ?? "https://trust.verifyyou.com";

/** Well-known JWKS endpoint holding the EdDSA public keys (by `kid`). */
export const JWKS_URL: string =
  import.meta.env.VITE_VERIFYYOU_JWKS_URL ??
  `${API_BASE}/.well-known/jwks.json`;

/** Query-string parameter the signed token arrives in. */
export const TOKEN_PARAM = "vy_token";

/** How long a fetched JWKS is trusted before a refresh, in milliseconds. */
export const JWKS_CACHE_TTL_MS = 60 * 60 * 1000; // 1h

/** Default network timeout for SDK requests, in milliseconds. */
export const REQUEST_TIMEOUT_MS = 10_000;
