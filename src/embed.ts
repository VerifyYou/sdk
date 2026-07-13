import { CONNECT_BASE } from "./config";
import { initialize } from "./connect";
import {
  EMBED_EMAIL_PARAM,
  EMBED_MSG_CLOSE,
  EMBED_MSG_COMPLETE,
  EMBED_MSG_RESIZE,
  EMBED_ORIGIN_PARAM,
  EMBED_PARAM,
  EMBED_PHONE_PARAM,
} from "./protocol";

/**
 * Iframe-embedded verification.
 *
 * Flow:
 *   1. The host page calls verify({ publishableKey }).
 *   2. We POST that key to connect-service `/v3/initialize` (browser-safe,
 *      cookieless CORS) and get back a full app-fe verification URL.
 *   3. We mount that URL in an iframe (drawer or inline) instead of redirecting.
 *   4. When the flow finishes, app-fe is expected to `postMessage` the verdict
 *      back to us (rather than `window.location.assign`ing the redirect URL).
 *
 * The app is told it's embedded via query params we append to the returned URL:
 *   vy_embed=1, vy_origin=<host origin>, optional vy_email/vy_phone. All keys
 *   are vy-prefixed on purpose: app-fe reserves that prefix, so its partner
 *   query-param passthrough never forwards them. (app-fe persists them on first
 *   load — the `?vys=` handoff redirects to `/verification/$id` and would
 *   otherwise drop them.)
 *
 * Message protocol (app-fe -> this parent, `event.data.type`; the param and
 * message names live in ./protocol.ts, mirrored in app-fe and pinned by
 * test/protocol.contract.test.ts):
 *   - "vy:complete"  { vyt, vyc, redirect_url }  (vyt=token, vyc="1"|"0")
 *   - "vy:close"     user dismissed / cancelled inside the app
 *   - "vy:resize"    { height }  inline-mode height sync
 */

export interface VerifyOptions {
  /** Publishable key (`pk_test_*` / `pk_live_*`) identifying the customer. */
  publishableKey: string;
  /**
   * @deprecated Configure the redirect URL on the verification in the Connect
   * portal instead. Still accepted and sent as a fallback for verifications
   * without a saved redirect URL. Defaults to `location.origin`.
   */
  origin?: string;
  /**
   * @deprecated Configure the redirect URL on the verification in the Connect
   * portal instead. Still accepted and sent as a fallback for verifications
   * without a saved redirect URL. Defaults to "/".
   */
  returnPath?: string;
  /**
   * Per-run verification-config override, forwarded verbatim to
   * `/v3/initialize` (connect never merges it with the stored config).
   * Test-mode only: connect-service rejects it on live keys ("config requires
   * a test key"). The shape is validated server-side, hence the loose type
   * until the generated types pick it up from connect's spec.
   */
  config?: Record<string, unknown>;
  /**
   * Prefill the login step (best-effort, UI only). A publishable key can't bind
   * identity server-side; that needs a secret key from the partner backend.
   */
  email?: string;
  phone?: string;
  /**
   * "drawer" (default) slides a panel over the page (a bottom sheet on mobile,
   * a side panel on desktop); "inline" mounts into `container`.
   */
  mode?: "drawer" | "inline";
  /** Target for inline mode: an element or a CSS selector. Required if inline. */
  container?: HTMLElement | string;
  /**
   * Inline-mode height. "fill" (default) makes the iframe fill the container;
   * just size the container with your own CSS, like an embedded video. "auto"
   * grows the iframe to the app's content height (via vy:resize). Or pass a CSS
   * length such as "640px".
   */
  inlineHeight?: "fill" | "auto" | (string & {});
  /**
   * Drawer color scheme. "auto" (default) follows the host page's effective
   * `color-scheme` (so class-toggled dark modes are respected), falling back
   * to the OS `prefers-color-scheme`. Only themes the drawer chrome shown
   * while the flow loads — the embedded app colors itself.
   */
  theme?: "light" | "dark" | "auto";
  /** connect-service origin. Defaults to the build-time CONNECT_BASE. */
  connectBase?: string;
  /** Fired (in addition to the returned promise resolving) on completion. */
  onComplete?: (result: VerifyResult) => void;
  /** Fired when the user dismisses the flow without completing. */
  onClose?: () => void;
}

export interface VerifyResult {
  /** Confirmation token (vyt). The partner verifies this server-side. */
  token: string | null;
  /** Verdict from vyc: true = approved (1), false = denied (0), null if absent. */
  approved: boolean | null;
  /** Raw verdict code ("1" | "0" | null), as delivered in the redirect URL. */
  vyc: string | null;
  /** Full backend-built redirect URL (carries vyt/vyc), when provided. */
  redirectUrl: string | null;
}

/** Handle to a live embedded flow; also a thenable resolving to the result. */
export interface VerifySession extends Promise<VerifyResult> {
  /** Tear down the iframe/overlay early. Resolves the promise as cancelled. */
  close(): void;
}

function resolveContainer(container?: HTMLElement | string): HTMLElement {
  if (container instanceof HTMLElement) return container;
  if (typeof container === "string") {
    const el = document.querySelector<HTMLElement>(container);
    if (!el) throw new Error(`VerifyYou: container "${container}" not found`);
    return el;
  }
  throw new Error("VerifyYou: inline mode requires a `container`");
}

/** Append the embed params to the URL connect-service returned. */
function withEmbedParams(
  rawUrl: string,
  opts: VerifyOptions,
): { src: string; appOrigin: string } {
  const url = new URL(rawUrl);
  url.searchParams.set(EMBED_PARAM, "1");
  // Always the real host-page origin (postMessage target), regardless of the
  // `origin` option — that one only feeds connect-service's redirect-URL build.
  url.searchParams.set(EMBED_ORIGIN_PARAM, location.origin);
  if (opts.email) url.searchParams.set(EMBED_EMAIL_PARAM, opts.email);
  if (opts.phone) url.searchParams.set(EMBED_PHONE_PARAM, opts.phone);
  return { src: url.toString(), appOrigin: url.origin };
}

function createIframe(): HTMLIFrameElement {
  const iframe = document.createElement("iframe");
  // Liveness needs camera/mic; storage-access lets the embedded app call
  // requestStorageAccess() (Safari/WebKit cookie support). All delegated here.
  iframe.allow = "camera; microphone; clipboard-write; storage-access";
  iframe.setAttribute("title", "VerifyYou verification");
  iframe.style.border = "0";
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.display = "block";
  return iframe;
}

// Minimal inline styles so the CDN build needs no separate stylesheet.
// The drawer is a bottom sheet under this width, a right-side panel above it.
const NARROW_QUERY = "(max-width: 640px)";
const DRAWER_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

// Card surface shown behind the iframe until the app paints. The dark value
// matches app-fe's dark boot background (#0d0f12) so card → first app paint is
// seamless; without a dark surface the drawer is a white flash over dark hosts.
const CARD_LIGHT = "#fff";
const CARD_DARK = "#0d0f12";

const SCRIM_STYLE: Partial<CSSStyleDeclaration> = {
  position: "fixed",
  inset: "0",
  background: "rgba(0,0,0,0.55)",
  zIndex: "2147483646",
  opacity: "0",
  transition: "opacity 320ms ease",
};

// "auto": the host page's declared color-scheme wins (class-based dark modes
// like next-themes set it on <html>, and it reflects a manual toggle the OS
// preference can't see); an absent/both-schemes value falls back to the OS.
function resolveDark(theme: VerifyOptions["theme"]): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  const scheme = getComputedStyle(document.documentElement).colorScheme || "";
  const dark = scheme.includes("dark");
  if (dark !== scheme.includes("light")) return dark;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// Position/size for the open drawer; the enter/exit slide is a transform on top.
function drawerCardStyle(narrow: boolean, dark: boolean): Partial<CSSStyleDeclaration> {
  const base: Partial<CSSStyleDeclaration> = {
    position: "fixed",
    background: dark ? CARD_DARK : CARD_LIGHT,
    overflow: "hidden",
    boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
    zIndex: "2147483647",
  };
  if (narrow) {
    return {
      ...base,
      left: "0",
      right: "0",
      bottom: "0",
      width: "100%",
      // Near-full height so the verification content fits without the iframe
      // scrolling. dvh tracks the visible viewport (excludes mobile browser
      // chrome), unlike vh which can overflow and reintroduce a scrollbar.
      height: "min(98dvh, 960px)",
      borderRadius: "16px 16px 0 0",
    };
  }
  return {
    ...base,
    top: "0",
    right: "0",
    bottom: "0",
    height: "100%",
    width: "min(440px, 100vw)",
    borderRadius: "16px 0 0 16px",
  };
}

// Off-screen resting transform: down for the bottom sheet, right for the panel.
function hiddenTransform(narrow: boolean): string {
  return narrow ? "translateY(100%)" : "translateX(100%)";
}

function assign(el: HTMLElement, style: Partial<CSSStyleDeclaration>): void {
  Object.assign(el.style, style);
}

/**
 * Start an embedded verification flow from a publishable key. Returns a thenable
 * session that resolves with the verdict once the app posts `vy:complete` (and
 * exposes `close()`). Rejects if the initialize call fails.
 */
export function verify(opts: VerifyOptions): VerifySession {
  const connectBase = opts.connectBase ?? CONNECT_BASE;
  const mode = opts.mode ?? "drawer";
  const inlineHeight = opts.inlineHeight ?? "fill";
  const iframe = createIframe();

  // Build the shell (drawer overlay or inline host) up front so close() works
  // and the user sees something while we call initialize().
  let mounted: HTMLElement; // element added to the DOM (removed on teardown)
  let playExit: (() => void) | undefined; // slide-out before removal (drawer)
  let cleanupBreakpoint: (() => void) | undefined; // drawer media-query listener
  // Invisible placeholder kept only for mount/teardown symmetry; no visible
  // "Starting verification…" text behind the iframe.
  const loading = document.createElement("div");
  assign(loading, {
    position: "absolute",
    inset: "0",
  });

  if (mode === "inline") {
    const host = resolveContainer(opts.container);
    // The container is the sizing authority; make sure it can host the absolute
    // loading placeholder (and any future overlay) rather than being static.
    if (getComputedStyle(host).position === "static") host.style.position = "relative";

    if (inlineHeight === "fill") {
      iframe.style.height = "100%"; // fill the container's height
    } else if (inlineHeight === "auto") {
      iframe.style.height = "600px"; // initial; vy:resize drives it to content
    } else {
      iframe.style.height = inlineHeight; // explicit CSS length
    }

    host.appendChild(loading);
    host.appendChild(iframe);
    mounted = iframe; // loading removed explicitly on settle

    if (inlineHeight === "fill") {
      // A percentage height resolves to 0 when the container has no height of
      // its own — fall back so the frame is never invisible, and tell them why.
      requestAnimationFrame(() => {
        if (iframe.clientHeight === 0) {
          iframe.style.height = "600px";
          console.warn(
            'VerifyYou: inline container has no height; give it a CSS height, ' +
              'or use inlineHeight: "auto". Falling back to 600px.',
          );
        }
      });
    }
  } else {
    // A wrapper holds the scrim + the fixed-position drawer card; removing it
    // tears both down at once. We render it in the browser's *top layer* via the
    // Popover API so the host page's z-index / stacking contexts can never cover
    // the drawer — no z-index war to win. Falls back to the max z-index on the
    // scrim/card when Popover is unsupported.
    const wrapper = document.createElement("div");
    const usePopover = typeof wrapper.showPopover === "function";
    if (usePopover) {
      wrapper.setAttribute("popover", "manual"); // we own dismiss (scrim/close)
      // Strip the UA popover chrome; the scrim/card are fixed and cover the
      // viewport, so the wrapper itself stays an invisible 0-size node.
      assign(wrapper, {
        margin: "0",
        padding: "0",
        border: "0",
        background: "transparent",
        width: "auto",
        height: "auto",
        maxWidth: "none",
        maxHeight: "none",
        inset: "auto",
        overflow: "visible",
      });
    }
    const scrim = document.createElement("div");
    assign(scrim, SCRIM_STYLE);

    const card = document.createElement("div");
    const dark = resolveDark(opts.theme);
    let narrow = window.matchMedia(NARROW_QUERY).matches;
    assign(card, drawerCardStyle(narrow, dark));
    card.style.transform = hiddenTransform(narrow);
    card.style.transition = `transform 360ms ${DRAWER_EASE}`;

    // No close button on the drawer chrome — the embedded app renders its own
    // close control (its header ×) and posts `vy:close` to dismiss. Tapping the
    // scrim also closes.
    card.appendChild(loading);
    card.appendChild(iframe);
    wrapper.appendChild(scrim);
    wrapper.appendChild(card);
    document.body.appendChild(wrapper);
    if (usePopover) wrapper.showPopover(); // promote to the top layer
    mounted = wrapper;
    scrim.addEventListener("click", () => onClose());

    // Drop the transform once the drawer is open. iOS WebKit mis-hit-tests
    // touches inside an iframe whose ancestor has *any* transform (even
    // translate(0,0)) — making the embedded app untappable — so at rest the
    // card must carry no transform; it's only re-armed for the slide animations.
    const settleOpen = () => {
      card.removeEventListener("transitionend", settleOpen);
      card.style.transform = "none";
    };

    // Re-flow the drawer if the viewport crosses the bottom-sheet/side-panel
    // breakpoint while open (e.g. desktop resize, phone rotation).
    const mq = window.matchMedia(NARROW_QUERY);
    const onBreakpoint = () => {
      narrow = mq.matches;
      assign(card, drawerCardStyle(narrow, dark));
      card.style.transform = "none"; // resting: no transform (see settleOpen)
    };
    mq.addEventListener("change", onBreakpoint);
    cleanupBreakpoint = () => mq.removeEventListener("change", onBreakpoint);

    // Slide in on the next frame so the browser paints the resting state first,
    // then clear the transform when the slide finishes.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        scrim.style.opacity = "1";
        card.addEventListener("transitionend", settleOpen);
        card.style.transform = "translate(0, 0)";
      }),
    );

    playExit = () => {
      // Re-arm the transition + transform for the slide-out (cleared at rest).
      card.removeEventListener("transitionend", settleOpen);
      card.style.transition = `transform 360ms ${DRAWER_EASE}`;
      card.style.transform = hiddenTransform(narrow);
      scrim.style.opacity = "0";
    };
  }

  let settled = false;
  let appOrigin = "";
  let resolveFn!: (r: VerifyResult) => void;
  let rejectFn!: (e: unknown) => void;

  const onMessage = (event: MessageEvent) => {
    if (!appOrigin || event.origin !== appOrigin) return;
    const data = event.data as Record<string, unknown> | null;
    if (!data || typeof data.type !== "string") return;

    switch (data.type) {
      case EMBED_MSG_COMPLETE: {
        const vyc = (data.vyc as string | null) ?? null;
        onComplete({
          token: (data.vyt as string | null) ?? null,
          approved: vyc === "1" ? true : vyc === "0" ? false : null,
          vyc,
          redirectUrl: (data.redirect_url as string | null) ?? null,
        });
        break;
      }
      case EMBED_MSG_CLOSE:
        onClose();
        break;
      case EMBED_MSG_RESIZE:
        if (mode === "inline" && inlineHeight === "auto" && typeof data.height === "number") {
          iframe.style.height = `${data.height}px`;
        }
        break;
    }
  };

  function teardown(): void {
    window.removeEventListener("message", onMessage);
    cleanupBreakpoint?.();
    if (playExit) {
      playExit();
      const node = mounted;
      window.setTimeout(() => {
        loading.remove();
        node.remove();
      }, 380);
    } else {
      loading.remove();
      mounted.remove();
    }
  }

  function onComplete(result: VerifyResult): void {
    if (settled) return;
    settled = true;
    teardown();
    opts.onComplete?.(result);
    resolveFn(result);
  }

  function onClose(): void {
    if (settled) return;
    settled = true;
    teardown();
    opts.onClose?.();
    // Resolve (rather than reject) with an empty verdict so a dismiss doesn't
    // require a try/catch around `await`.
    resolveFn({ token: null, approved: null, vyc: null, redirectUrl: null });
  }

  function fail(err: unknown): void {
    if (settled) return;
    settled = true;
    teardown();
    rejectFn(err);
  }

  // Kick off init, then point the iframe at the returned URL.
  window.addEventListener("message", onMessage);
  initialize({
    publishableKey: opts.publishableKey,
    origin: opts.origin,
    returnPath: opts.returnPath,
    config: opts.config,
    connectBase,
  })
    .then((rawUrl) => {
      if (settled) return; // closed before init resolved
      const built = withEmbedParams(rawUrl, opts);
      appOrigin = built.appOrigin;
      iframe.addEventListener("load", () => loading.remove(), { once: true });
      iframe.src = built.src;
    })
    .catch(fail);

  const promise = new Promise<VerifyResult>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  }) as VerifySession;
  promise.close = onClose;
  // Avoid unhandled-rejection noise if the caller only uses callbacks.
  void promise.catch(() => {});
  return promise;
}
