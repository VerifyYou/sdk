import { API_BASE } from "./config";
import { fetchWithTimeout } from "./http";
import { VerifyYouError } from "./errors";

export { VerifyYouError } from "./errors";
export type { VerifyYouErrorCode } from "./errors";
export { readTokenFromUrl, verifyToken } from "./token";
export type { TokenPayload } from "./token";

// Legacy-compatible API: init/vycheck/vyget. Defaults to the redirect flow;
// opt into the iframe with init({ mode: "iframe" }).
export { init, vycheck, vyget } from "./client";
export type { InitConfig, VyCheckOptions, VyResult, VerifyMode } from "./client";

// Direct iframe primitive (what the iframe flow is built on).
export { verify } from "./embed";
export type { VerifyOptions, VerifyResult, VerifySession } from "./embed";

/**
 * Plain JSON request against the API. Response trust comes from the signed
 * token flow (verifyToken), not from these calls.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, init);
  const body = await res.text();
  if (!res.ok) {
    throw new VerifyYouError(`HTTP ${res.status}`, "http", res.status);
  }
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new VerifyYouError("response was not valid JSON", "bad_response");
  }
}

// Reserved for the post-verification credential claim flow; not part of the
// iframe prototype yet. `request` is the plumbing it'll use.
export async function claim(): Promise<void> {
  void request;
}
