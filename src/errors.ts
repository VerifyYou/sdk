export type VerifyYouErrorCode =
  | "timeout"
  | "network"
  | "http"
  | "bad_response"; // API response wasn't valid JSON

export class VerifyYouError extends Error {
  constructor(
    message: string,
    readonly code: VerifyYouErrorCode,
    readonly status?: number,
  ) {
    super(message);
    this.name = "VerifyYouError";
  }
}
