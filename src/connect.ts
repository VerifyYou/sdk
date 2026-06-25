import { CONNECT_BASE } from "./config";

export interface InitializeParams {
  /** Publishable key (`pk_test_*` / `pk_live_*`) identifying the customer. */
  publishableKey: string;
  /** Host origin reported to connect-service. Defaults to `location.origin`. */
  origin?: string;
  /** Return path on the host origin. Defaults to "/". */
  returnPath?: string;
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
    }),
  });
  if (!res.ok) {
    throw new Error(`VerifyYou: initialize failed (HTTP ${res.status})`);
  }
  const data = (await res.json()) as { url?: string };
  if (!data?.url) throw new Error("VerifyYou: initialize returned no url");
  return data.url;
}
