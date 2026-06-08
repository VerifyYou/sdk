import { externalInitialize } from "./api/generated";
import { client } from "./api/generated/client.gen";
import { resolveBaseUrl } from "./config";
import { vyget } from "./vyget";

export interface VyConfig {
  /** Publishable key (`pk_*`) — browser/SDK use. */
  publishableKey?: string;
  /** Secret key (`sk_*`) — server-side use of the typed functions + sk-only params. */
  secretKey?: string;
  /** Override the API base URL (defaults to prod, then the VERIFYYOU_API_URL env var). */
  baseUrl?: string;
  /** Custom fetch implementation (SSR / tests). */
  fetch?: typeof globalThis.fetch;
}

export interface VyCheckOptions {
  /** Optional correlation label that rides the flow-event payload. */
  externalTracker?: string;
}

let initialized = false;

/**
 * Configure the SDK once at startup (sets the key + base URL on the shared
 * client). Call before {@link vycheck} or the generated `external*` functions.
 *
 * @example
 * import { init, vyget, vycheck } from "@verifyyou-sdk/client";
 * init({ publishableKey: "pk_live_…" });
 * if (!vyget().token) await vycheck();
 */
export function init(config: VyConfig = {}): void {
  const key = config.secretKey ?? config.publishableKey;
  client.setConfig({
    baseUrl: resolveBaseUrl(config.baseUrl),
    ...(config.fetch ? { fetch: config.fetch } : {}),
    ...(key ? { headers: { Authorization: `Bearer ${key}` } } : {}),
  });
  initialized = true;
}

/**
 * Return the `vyt` token if it's already in the URL; otherwise start a
 * verification for the current page and redirect the browser to the hosted flow.
 * Requires {@link init} to have been called (unless a token is already present).
 */
export async function vycheck(opts: VyCheckOptions = {}): Promise<string | undefined> {
  const existing = vyget().token;
  if (existing) return existing;

  if (!initialized) {
    throw new Error("VerifyYou SDK not initialized — call init({ publishableKey }) first");
  }
  if (typeof window === "undefined") {
    throw new Error("vycheck() requires a browser environment");
  }

  // Carry inbound query params through the round-trip, minus reserved vy* keys.
  const passParams: Record<string, string> = {};
  new URLSearchParams(window.location.search).forEach((value, k) => {
    if (!k.toLowerCase().startsWith("vy")) passParams[k] = value;
  });

  const { data } = await externalInitialize({
    throwOnError: true,
    body: {
      origin: window.location.origin,
      start_path: window.location.pathname,
      external_tracker: opts.externalTracker,
      pass_params: Object.keys(passParams).length ? passParams : undefined,
    },
  });

  if (data?.url) window.location.assign(data.url);
  return undefined;
}
