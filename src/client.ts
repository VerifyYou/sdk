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

  // --- iframe presentation (ignored in redirect mode) ---
  /** "drawer" (default) overlays the page; "inline" mounts into `container`. */
  display?: "drawer" | "inline";
  /** Target for inline display: an element or a CSS selector. */
  container?: HTMLElement | string;
  /** Inline height: "fill" (default), "auto", or a CSS length like "640px". */
  inlineHeight?: "fill" | "auto" | (string & {});
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
export type VyCheckOptions = Partial<Omit<InitConfig, "publishableKey" | "mode">>;

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

/** Store SDK configuration. Call once on page load. */
export function init(cfg: InitConfig): void {
  config = cfg;
}

/**
 * Start verification.
 * - redirect mode (default): navigates to the hosted flow; the returned promise
 *   never resolves because the page unloads. On return, read it with vyget().
 * - iframe mode: mounts the embedded flow, resolves with the result, fires
 *   onComplete, and caches it so vyget() returns it too.
 */
export async function vycheck(overrides?: VyCheckOptions): Promise<VyResult> {
  const cfg = { ...ensureConfig(), ...overrides };
  const mode = cfg.mode ?? "redirect";

  if (mode === "iframe") {
    const result = await verify({
      publishableKey: cfg.publishableKey,
      origin: cfg.origin,
      returnPath: cfg.returnPath,
      connectBase: cfg.connectBase,
      email: cfg.email,
      phone: cfg.phone,
      mode: cfg.display ?? "drawer",
      container: cfg.container,
      inlineHeight: cfg.inlineHeight,
      onClose: cfg.onClose,
      // onComplete handled here so we hand back the unified VyResult shape.
    });
    const vy = toVyResult(result);
    // verify() also resolves (empty) on dismiss; only treat a real verdict as a
    // completion (onClose has already fired for the dismiss case).
    if (vy.token != null || vy.vyc != null) {
      lastResult = vy;
      cfg.onComplete?.(vy);
    }
    return vy;
  }

  const url = await initialize({
    publishableKey: cfg.publishableKey,
    origin: cfg.origin,
    returnPath: cfg.returnPath,
    connectBase: cfg.connectBase,
  });
  window.location.assign(url);
  return new Promise<VyResult>(() => {}); // page is navigating away
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
