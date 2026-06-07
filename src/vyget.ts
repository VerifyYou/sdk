export interface VyResult {
  /** The verdict from the `vyc` return param: true (approved), false (denied), or
   *  undefined if absent. Client-side convenience — verify server-side with `token`. */
  verified: boolean | undefined;
  /** The `vyt` confirmation token from the return URL, if present. Pass it to your
   *  backend (secret key → GET /v3/confirmations/{token}) for an authoritative check. */
  token: string | undefined;
}

/** Synchronously read the verification result the hosted flow appended to the
 *  current URL. Safe to call anywhere; returns empty values outside a browser. */
export function vyget(): VyResult {
  if (typeof window === "undefined") {
    return { verified: undefined, token: undefined };
  }
  const params = new URLSearchParams(window.location.search);
  const vyc = params.get("vyc");
  const verified = vyc === "1" ? true : vyc === "0" ? false : undefined;
  return { verified, token: params.get("vyt") ?? undefined };
}
