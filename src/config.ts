/**
 * Static SDK configuration.
 *
 * The flow returns a confirmation token as a URL query param (`vyt`, with the
 * verdict in `vyc`). The token is trusted by confirming it server-side
 * (`GET /v3/confirmations/{token}`) — there's no client-side signature check,
 * no API key, and no runtime `configure()` step. Everything here is baked in at
 * build time (overridable via Vite env vars).
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

/**
 * app-fe origin the SDK builds hosted verification URLs against when the caller
 * hands it a bare session id (from a server-side `POST /v3/initialize`) instead
 * of a full URL. Override at build time with `VITE_VERIFYYOU_APP_BASE` (e.g.
 * http://localhost:5173 for local dev), or per-init via `appBase`.
 *
 * The SDK owns this origin so a caller can never point the iframe at an
 * arbitrary host — the session id is opaque data, not a URL. Even so, every
 * constructed URL is re-checked against the VerifyYou allowlist
 * (`assertVerifyYouUrl`), so a build that overrides this to a non-VerifyYou
 * origin fails loudly rather than silently mounting a look-alike.
 */
export const APP_BASE: string =
  import.meta.env.VITE_VERIFYYOU_APP_BASE ?? "https://app.verifyyou.com";

/** Default network timeout for SDK requests, in milliseconds. */
export const REQUEST_TIMEOUT_MS = 10_000;
