const PROD_BASE_URL = "https://trust.verifyyou.com";

function envBaseUrl(): string | undefined {
  if (typeof process !== "undefined" && process.env && process.env.VERIFYYOU_API_URL) {
    return process.env.VERIFYYOU_API_URL;
  }
  return undefined;
}

export function resolveBaseUrl(explicit?: string): string {
  return explicit ?? envBaseUrl() ?? PROD_BASE_URL;
}
