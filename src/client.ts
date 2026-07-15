import { API_BASE, APP_BASE, CONNECT_BASE } from "./config";
import { initialize } from "./connect";
import { verify } from "./embed";
import type { VerifyResult } from "./embed";
import { VERDICT_CODE_PARAM, VERDICT_TOKEN_PARAM } from "./protocol";

export type VerifyMode = "redirect" | "iframe";

/**
 * Unified verification result for both flows. `verified` is a UI hint only;
 * always confirm `token` on your backend (`GET /v3/confirmations/{token}`).
 */
export interface VyResult {
  /** Confirmation token (vyt). Verify this server-side. */
  token: string | null;
  /** Verdict (vyc === "1"). UI hint only. */
  verified: boolean;
  /** Raw verdict code ("1" | "0" | null). */
  vyc: string | null;
}

export interface InitConfig {
  /** Publishable key (`pk_test_*` / `pk_live_*`). Safe in the browser. */
  publishableKey: string;
  /**
   * "redirect" (default) navigates the user to the hosted flow; "iframe" embeds
   * it in place. This is the opt-in; leave it off to keep the legacy redirect.
   */
  mode?: VerifyMode;
  /** connect-service origin. Defaults to the build-time CONNECT_BASE. */
  connectBase?: string;
  /**
   * app-fe origin the SDK builds a hosted URL against when you open a session by
   * id (`vycheck({ session })`). Defaults to the build-time APP_BASE. Must be a
   * VerifyYou origin — the SDK rejects anything else.
   */
  appBase?: string;
  /**
   * @deprecated Configure the redirect URL on the verification in the Connect
   * portal instead. Still accepted and sent as a fallback for verifications
   * without a saved redirect URL. Defaults to `location.origin`.
   */
  origin?: string;
  /**
   * @deprecated Configure the redirect URL on the verification in the Connect
   * portal instead. Still accepted and sent as a fallback for verifications
   * without a saved redirect URL. Defaults to "/".
   */
  returnPath?: string;
  /**
   * Per-run verification-config override, forwarded verbatim to
   * `/v3/initialize` (connect never merges it with the stored config).
   * Test-mode only: connect-service rejects it on live keys ("config requires
   * a test key"). Overridable per call via vycheck({ config }). The shape is
   * validated server-side, hence the loose type until the generated types
   * pick it up from connect's spec.
   */
  config?: Record<string, unknown>;

  // --- iframe presentation (ignored in redirect mode) ---
  /** "drawer" (default) overlays the page; "inline" mounts into `container`. */
  display?: "drawer" | "inline";
  /** Target for inline display: an element or a CSS selector. */
  container?: HTMLElement | string;
  /** Inline height: "fill" (default), "auto", or a CSS length like "640px". */
  inlineHeight?: "fill" | "auto" | (string & {});
  /** Drawer color scheme: "auto" (default) follows the host page's
   *  color-scheme, falling back to the OS preference. */
  theme?: "light" | "dark" | "auto";
  /** Prefill the login step (UI only; identity binding needs a secret key). */
  email?: string;
  phone?: string;

  // --- lifecycle callbacks (iframe; redirect navigates away so these no-op) ---
  /** Fired with the verdict when the flow completes. */
  onComplete?: (result: VyResult) => void;
  /** Fired when the user dismisses the iframe without completing. */
  onClose?: () => void;
}

/** Per-call overrides for vycheck(); anything here overrides the init config
 *  (except the publishable key and mode, which are fixed at init). */
export type VyCheckOptions = Partial<Omit<InitConfig, "publishableKey" | "mode">> & {
  /**
   * Open a session already created server-side, by its id. Pass the `session_id`
   * a `POST /v3/initialize` (SECRET key) returned — the only way to preload
   * `external_id` or a bound identity. The id is opaque data; the SDK builds the
   * hosted URL against its own VerifyYou-locked `appBase`, so a caller can never
   * steer the iframe to another origin. When set, vycheck SKIPS its own
   * initialize and opens THAT session (the init() publishable key goes unused).
   * Works in iframe display (the primary case); with `mode: "redirect"` it
   * navigates straight to the built URL.
   */
  session?: string;
};

const TOKEN_PARAM = VERDICT_TOKEN_PARAM;
const VERDICT_PARAM = VERDICT_CODE_PARAM;

let config: InitConfig | null = null;
let lastResult: VyResult | null = null; // iframe completion, surfaced via vyget()

function ensureConfig(): InitConfig {
  if (!config) {
    throw new Error("VerifyYou: call init({ publishableKey }) before vycheck()/vyget().");
  }
  return config;
}

function toVyResult(r: VerifyResult): VyResult {
  return { token: r.token, verified: r.vyc === "1", vyc: r.vyc };
}

function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}

// Registrable domain, good enough for our simple two-label apexes
// (verifyyou.com / verifyyou.io) — no public-suffix list needed.
function registrableDomain(base: string): string | null {
  try {
    const { hostname } = new URL(base);
    const parts = hostname.split(".");
    return parts.length <= 2 ? hostname : parts.slice(-2).join(".");
  } catch {
    return null;
  }
}

/**
 * Guard the hosted URL the SDK builds for `vycheck({ session })`. The origin
 * comes from `appBase` (SDK-owned, never the caller), but an appBase override to
 * a non-VerifyYou host would silently mount a look-alike — so re-check it here.
 * The allowlist is the registrable domain of the configured connect/api origins
 * (plus any per-init connectBase override), with localhost permitted for dev.
 */
function assertVerifyYouUrl(rawUrl: string, connectBase?: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("VerifyYou: appBase must be an absolute VerifyYou URL");
  }
  const local = isLocalHost(parsed.hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && local)) {
    throw new Error("VerifyYou: appBase must be an https VerifyYou URL");
  }
  const allowed = [CONNECT_BASE, API_BASE, connectBase]
    .filter((b): b is string => b != null)
    .map(registrableDomain)
    .filter((d): d is string => d != null);
  const ok =
    local || allowed.some((d) => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`));
  if (!ok) {
    throw new Error(
      `VerifyYou: appBase must be a VerifyYou verification URL (got ${parsed.origin})`,
    );
  }
  return parsed.toString();
}

/**
 * Build the hosted verification URL for a server-minted session id. The origin
 * comes from the SDK's own (VerifyYou-locked) `appBase`, never the caller — the
 * session id is opaque data — and the finished URL is still run through
 * assertVerifyYouUrl so an appBase override to a non-VerifyYou host fails loudly
 * instead of mounting a look-alike. The `?vys=` shape matches what
 * `/v3/initialize` returns; app-fe reads it and calls `/verification/flow/load`.
 */
function sessionUrlFromId(sessionId: string, appBase: string, connectBase?: string): string {
  const id = sessionId.trim();
  if (!id) {
    throw new Error("VerifyYou: vycheck({ session }) needs a non-empty session id");
  }
  const base = appBase.replace(/\/+$/, "");
  return assertVerifyYouUrl(`${base}/verification?vys=${encodeURIComponent(id)}`, connectBase);
}

/** Store SDK configuration. Call once on page load. */
export function init(cfg: InitConfig): void {
  config = cfg;
}

/** A vycheck() call: awaitable for the result, with `close()` to tear the
 *  embed down early. `close()` is a no-op in redirect mode (the page unloads). */
export interface VyCheckHandle extends Promise<VyResult> {
  /** Dismiss an inline/drawer embed before it completes; resolves the promise
   *  as an empty (cancelled) result. No-op once the run has settled. */
  close(): void;
}

/**
 * Start verification.
 * - redirect mode (default): navigates to the hosted flow; the returned promise
 *   never resolves because the page unloads. On return, read it with vyget().
 * - iframe mode: mounts the embedded flow, resolves with the result, fires
 *   onComplete, and caches it so vyget() returns it too. Call `close()` on the
 *   returned handle to tear the embed down early (e.g. before a relaunch).
 */
export function vycheck(overrides?: VyCheckOptions): VyCheckHandle {
  // vycheck() is sync (so it can hand back a close() handle), but validation
  // errors should still surface as a rejected promise the way the old async
  // version did — never a synchronous throw the caller has to try/catch around.
  try {
    return runCheck(overrides);
  } catch (err) {
    const handle = Promise.reject(err) as VyCheckHandle;
    handle.close = () => {};
    void handle.catch(() => {});
    return handle;
  }
}

function runCheck(overrides?: VyCheckOptions): VyCheckHandle {
  const cfg = { ...ensureConfig(), ...overrides };
  const mode = cfg.mode ?? "redirect";
  // A bare session id (from a server-side /v3/initialize) skips our own
  // initialize: the SDK builds the hosted URL against its VerifyYou-locked
  // appBase, so the caller never supplies an origin to mount.
  const sessionUrl =
    cfg.session != null
      ? sessionUrlFromId(cfg.session, cfg.appBase ?? APP_BASE, cfg.connectBase)
      : undefined;

  if (mode === "iframe") {
    const session = verify({
      // A pre-initialized session URL is mounted as-is; otherwise verify()
      // exchanges the publishable key via /v3/initialize.
      sessionUrl,
      publishableKey: cfg.publishableKey,
      origin: cfg.origin,
      returnPath: cfg.returnPath,
      config: cfg.config,
      connectBase: cfg.connectBase,
      email: cfg.email,
      phone: cfg.phone,
      mode: cfg.display ?? "drawer",
      container: cfg.container,
      inlineHeight: cfg.inlineHeight,
      theme: cfg.theme,
      onClose: cfg.onClose,
      // onComplete handled here so we hand back the unified VyResult shape.
    });
    const handle = session.then((result) => {
      const vy = toVyResult(result);
      // verify() also resolves (empty) on dismiss; only treat a real verdict as
      // a completion (onClose has already fired for the dismiss case).
      if (vy.token != null || vy.vyc != null) {
        lastResult = vy;
        cfg.onComplete?.(vy);
      }
      return vy;
    }) as VyCheckHandle;
    handle.close = () => session.close();
    void handle.catch(() => {}); // callers may use onComplete only
    return handle;
  }

  // redirect display: navigate straight to a pre-initialized session URL, or
  // exchange the publishable key via /v3/initialize first.
  const handle = (async () => {
    const url =
      sessionUrl ??
      (await initialize({
        publishableKey: cfg.publishableKey,
        origin: cfg.origin,
        returnPath: cfg.returnPath,
        config: cfg.config,
        connectBase: cfg.connectBase,
      }));
    window.location.assign(url);
    return new Promise<VyResult>(() => {}); // page is navigating away
  })() as VyCheckHandle;
  handle.close = () => {}; // nothing to tear down; the page is navigating away
  void handle.catch(() => {});
  return handle;
}

/**
 * Read the verification result.
 * - redirect mode: parses ?vyt/?vyc the hosted flow appended to the URL on
 *   return.
 * - iframe mode: returns the last completed result (or empty).
 * After confirming the token on your backend, strip ?vyt/?vyc from the URL so a
 * refresh can't reuse it.
 */
export function vyget(): VyResult {
  const params = new URLSearchParams(location.search);
  const token = params.get(TOKEN_PARAM);
  const vyc = params.get(VERDICT_PARAM);
  if (token != null || vyc != null) {
    return { token, verified: vyc === "1", vyc };
  }
  return lastResult ?? { token: null, verified: false, vyc: null };
}
