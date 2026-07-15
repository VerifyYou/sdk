export { VerifyYouError } from "./errors";
export type { VerifyYouErrorCode } from "./errors";

// Legacy-compatible API: init/vycheck/vyget. Defaults to the redirect flow;
// opt into the iframe with init({ mode: "iframe" }). To open a session already
// created server-side (POST /v3/initialize with a secret key — the path for
// preloading external_id / a bound identity), pass vycheck({ session }) with
// the returned session_id.
export { init, vycheck, vyget } from "./client";
export type { InitConfig, VyCheckOptions, VyResult, VerifyMode } from "./client";
