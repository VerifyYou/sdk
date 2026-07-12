import { CONNECT_BASE } from "./config";

export interface InitializeParams {
  /** Publishable key (`pk_test_*` / `pk_live_*`) identifying the customer. */
  publishableKey: string;
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
   * Per-run verification-config override, sent verbatim as the request's
   * `config` field (connect never merges it with the stored config). Test-mode
   * only: connect-service rejects it on live keys ("config requires a test
   * key"). The shape is validated server-side, hence the loose type until the
   * generated types pick it up from connect's spec.
   */
  config?: Record<string, unknown>;
  /** connect-service origin. Defaults to the build-time CONNECT_BASE. */
  connectBase?: string;
}

/**
 * Exchange a publishable key for a hosted verification URL via connect-service
 * `/v3/initialize` (browser-safe, cookieless CORS). Shared by both the redirect
 * flow (vycheck → navigate to the URL) and the iframe flow (verify → mount it).
 */
export async function initialize(params: InitializeParams): Promise<string> {
  const connectBase = params.connectBase ?? CONNECT_BASE;
  const res = await fetch(`${connectBase}/v3/initialize`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${params.publishableKey}`,
    },
    body: JSON.stringify({
      origin: params.origin ?? location.origin,
      return_path: params.returnPath ?? "/",
      ...(params.config !== undefined && { config: params.config }),
    }),
  });
  if (!res.ok) {
    throw new Error(`VerifyYou: initialize failed (HTTP ${res.status})`);
  }
  const data = (await res.json()) as { url?: string };
  if (!data?.url) throw new Error("VerifyYou: initialize returned no url");
  return data.url;
}
