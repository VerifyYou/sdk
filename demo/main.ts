import { init, vycheck, vyget } from "../src/index";

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const out = $("out") as HTMLPreElement;
const inlineHost = $("inline-host") as HTMLDivElement;

function log(label: string, value: unknown): void {
  out.textContent = `${label}\n${JSON.stringify(value, null, 2)}`;
}

function radio(name: string): string {
  return (
    document.querySelector(`input[name="${name}"]:checked`) as HTMLInputElement
  )?.value;
}

const returned = vyget();
if (returned.token != null || returned.vyc != null) {
  log("returned from redirect (vyget)", returned);
}

$("verifyBtn").addEventListener("click", async () => {
  const publishableKey = ($("publishableKey") as HTMLInputElement).value.trim();
  if (!publishableKey) {
    log("error", "paste your publishable key first (pk_test_…)");
    return;
  }
  const mode = radio("flow") === "iframe" ? "iframe" : "redirect";
  const display = radio("display") === "inline" ? "inline" : "drawer";
  const email = ($("email") as HTMLInputElement).value.trim() || undefined;

  inlineHost.innerHTML = "";
  log(
    "status",
    `launching ${mode}${mode === "iframe" ? ` (${display})` : ""} flow…`,
  );

  init({
    publishableKey,
    mode,
    display,
    email,
    container: display === "inline" ? inlineHost : undefined,
    connectBase: location.origin,
    onComplete: (r) => log("onComplete", r),
    onClose: () => log("status", "flow closed"),
  });

  try {
    // redirect mode navigates away (never resolves); iframe resolves the result.
    const result = await vycheck();
    log("vycheck result", result);
  } catch (err) {
    log("error", String(err));
  }
});
