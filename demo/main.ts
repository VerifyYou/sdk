// Demo "partner site" wiring: imports the SDK straight from source so changes
// to src/embed.ts hot-reload here. Mirrors how a host site would call the CDN
// global `VerifyYou`.
import { verify } from "../src/index";

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const out = $("out") as HTMLPreElement;
const inlineHost = $("inline-host") as HTMLDivElement;

function log(label: string, value: unknown): void {
  out.textContent = `${label}\n${JSON.stringify(value, null, 2)}`;
}

$("verifyBtn").addEventListener("click", async () => {
  const publishableKey = ($("publishableKey") as HTMLInputElement).value.trim();
  if (!publishableKey) {
    log("error", "paste your publishable key first (pk_test_…)");
    return;
  }
  const mode =
    (document.querySelector('input[name="mode"]:checked') as HTMLInputElement)
      ?.value === "inline"
      ? "inline"
      : "drawer";

  inlineHost.innerHTML = "";
  log("status", `launching ${mode} flow…`);

  try {
    const result = await verify({
      publishableKey,
      mode,
      container: mode === "inline" ? inlineHost : undefined,
      // Call connect through this page's own origin (vite proxies /v3 to
      // connect), so an https demo never makes a blocked http fetch.
      connectBase: location.origin,
      onClose: () => log("status", "flow closed"),
    });
    log("vy:complete", result);
  } catch (err) {
    log("error", String(err));
  }
});
