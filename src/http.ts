import { REQUEST_TIMEOUT_MS } from "./config";
import { VerifyYouError } from "./errors";

/** fetch() with an AbortController timeout, normalizing failures to VerifyYouError. */
export async function fetchWithTimeout(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } catch (err) {
    if (ctrl.signal.aborted) {
      throw new VerifyYouError("request timed out", "timeout");
    }
    throw new VerifyYouError(String(err), "network");
  } finally {
    clearTimeout(timer);
  }
}
