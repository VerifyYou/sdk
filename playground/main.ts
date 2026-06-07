import { init, vycheck, vyget } from "@verifyyou-sdk/client";

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const pkInput = el<HTMLInputElement>("pk");
const baseInput = el<HTMLInputElement>("base");
const resultEl = el("result");
const logEl = el("log");

const log = (msg: string): void => {
  logEl.textContent = `${new Date().toLocaleTimeString()}  ${msg}\n${logEl.textContent ?? ""}`;
};

pkInput.value = localStorage.getItem("vy_pk") ?? "";
baseInput.value = localStorage.getItem("vy_base") ?? "https://trust.verifyyou.com";

function showResult(): void {
  const res = vyget();
  resultEl.textContent = JSON.stringify(res, null, 2);
  if (res.token) {
    log("Back with a token — your backend would verify it: GET /v3/confirmations/{token} (sk).");
  } else if (res.verified !== undefined) {
    log(`Back with verdict only: verified=${res.verified}.`);
  }
}

showResult();

el("verify").addEventListener("click", async () => {
  const publishableKey = pkInput.value.trim();
  const baseUrl = baseInput.value.trim() || undefined;
  localStorage.setItem("vy_pk", publishableKey);
  localStorage.setItem("vy_base", baseUrl ?? "");

  if (!publishableKey) {
    log("Enter a publishable key first.");
    return;
  }

  init({ publishableKey, baseUrl });
  const existing = vyget().token;
  if (existing) {
    log(`vycheck() would return the existing token immediately: ${existing.slice(0, 12)}…`);
    return;
  }
  log("vycheck(): no token in URL → calling /v3/initialize, then redirecting…");
  try {
    await vycheck({ externalTracker: "playground" });
  } catch (e) {
    log(`vycheck() failed: ${(e as Error).message}`);
  }
});

el("reread").addEventListener("click", showResult);

el("clear").addEventListener("click", () => {
  window.history.replaceState({}, "", window.location.pathname);
  showResult();
  log("Cleared return params from the URL.");
});
