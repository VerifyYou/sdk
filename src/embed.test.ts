import { afterEach, describe, expect, it, vi } from "vitest";

import { verify } from "./embed";

// The iframe flow's contract with app-fe: after initialize() returns a hosted
// URL, the SDK appends embed params and mounts it, then listens for the app to
// postMessage the verdict back (origin-checked). app-fe's embed side is the
// MAIN-671 work; these tests pin the SDK half against a synthetic app.
const APP_URL = "https://app.localhost/verification/abc";
const APP_ORIGIN = "https://app.localhost";

function mockInitialize(url = APP_URL) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue({ ok: true, status: 200, json: async () => ({ url }) });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

async function mountInline() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const session = verify({
    publishableKey: "pk_test_1",
    connectBase: "http://localhost:8090",
    mode: "inline",
    container,
  });
  const iframe = await vi.waitFor(() => {
    const el = container.querySelector("iframe");
    if (!el || !el.getAttribute("src")) throw new Error("iframe not mounted with src yet");
    return el as HTMLIFrameElement;
  });
  return { session, iframe };
}

describe("verify() iframe flow", () => {
  it("appends the embed params (vy_embed, vy_origin) to the hosted URL", async () => {
    mockInitialize();
    const { iframe } = await mountInline();
    const src = new URL(iframe.src);
    expect(src.origin + src.pathname).toBe(APP_URL);
    expect(src.searchParams.get("vy_embed")).toBe("1");
    expect(src.searchParams.get("vy_origin")).toBe(location.origin);
    // Every appended key must be vy-prefixed — app-fe reserves the prefix so
    // its partner query-param passthrough never forwards SDK params.
    for (const key of src.searchParams.keys()) {
      expect(key.startsWith("vy")).toBe(true);
    }
  });

  it("resolves with the verdict when app-fe posts vy:complete from the app origin", async () => {
    mockInitialize();
    const { session } = await mountInline();
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: APP_ORIGIN,
        data: {
          type: "vy:complete",
          vyt: "tok_9",
          vyc: "1",
          redirect_url: "https://shop/return?vyt=tok_9&vyc=1",
        },
      }),
    );
    await expect(session).resolves.toEqual({
      token: "tok_9",
      approved: true,
      vyc: "1",
      redirectUrl: "https://shop/return?vyt=tok_9&vyc=1",
    });
  });

  it("forwards a per-run config override to /v3/initialize", async () => {
    const fetchMock = mockInitialize();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const config = { skip_check: true, identity: { mode: "anonymous" } };
    const session = verify({
      publishableKey: "pk_test_1",
      connectBase: "http://localhost:8090",
      mode: "inline",
      container,
      config,
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).config).toEqual(config);
    session.close(); // teardown listeners
  });

  // jsdom has no matchMedia; the drawer needs it for the breakpoint + the
  // "auto" theme's OS fallback. Returns a handle to flip the narrow query so
  // tests can drive the breakpoint re-flow.
  function stubMatchMedia(osDark: boolean) {
    const narrowListeners: Array<(e: { matches: boolean }) => void> = [];
    const narrowMql = {
      matches: false,
      addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => {
        narrowListeners.push(fn);
      },
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) =>
        query.includes("prefers-color-scheme")
          ? { matches: osDark, addEventListener: vi.fn(), removeEventListener: vi.fn() }
          : narrowMql,
      ),
    );
    return {
      setNarrow(matches: boolean) {
        narrowMql.matches = matches;
        for (const fn of narrowListeners) fn({ matches });
      },
    };
  }

  function mountDrawer(theme?: "light" | "dark" | "auto") {
    mockInitialize();
    const session = verify({
      publishableKey: "pk_test_1",
      connectBase: "http://localhost:8090",
      theme,
    });
    const wrapper = document.body.lastElementChild as HTMLElement;
    const card = wrapper.lastElementChild as HTMLElement;
    return { session, card };
  }

  describe("drawer theme", () => {
    afterEach(() => {
      document.documentElement.style.colorScheme = "";
    });

    it("defaults to a light card", () => {
      stubMatchMedia(false);
      const { session, card } = mountDrawer();
      expect(card.style.background).toBe("rgb(255, 255, 255)");
      session.close();
    });

    it('renders a dark card for theme: "dark"', () => {
      stubMatchMedia(false);
      const { session, card } = mountDrawer("dark");
      expect(card.style.background).toBe("rgb(13, 15, 18)");
      session.close();
    });

    it('"auto" follows the OS prefers-color-scheme', () => {
      stubMatchMedia(true);
      const { session, card } = mountDrawer("auto");
      expect(card.style.background).toBe("rgb(13, 15, 18)");
      session.close();
    });

    it('"auto" lets the host page\'s color-scheme override the OS', () => {
      stubMatchMedia(false); // OS light…
      document.documentElement.style.colorScheme = "dark"; // …host toggled dark
      const { session, card } = mountDrawer("auto");
      expect(card.style.background).toBe("rgb(13, 15, 18)");
      session.close();
    });

    it('an explicit "light" wins over a dark host page', () => {
      stubMatchMedia(true);
      document.documentElement.style.colorScheme = "dark";
      const { session, card } = mountDrawer("light");
      expect(card.style.background).toBe("rgb(255, 255, 255)");
      session.close();
    });

    it("keeps the dark card across the bottom-sheet breakpoint re-flow", () => {
      const mm = stubMatchMedia(false);
      const { session, card } = mountDrawer("dark");
      expect(card.style.background).toBe("rgb(13, 15, 18)");
      mm.setNarrow(true);
      expect(card.style.borderRadius).toBe("16px 16px 0 0"); // re-flowed to bottom sheet…
      expect(card.style.background).toBe("rgb(13, 15, 18)"); // …still on the dark surface
      session.close();
    });
  });

  it("ignores vy:complete from a foreign origin (postMessage spoofing guard)", async () => {
    mockInitialize();
    const { session } = await mountInline();
    let settled = false;
    void session.then(() => {
      settled = true;
    });
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://evil.example",
        data: { type: "vy:complete", vyt: "spoofed", vyc: "1" },
      }),
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(settled).toBe(false);
    session.close(); // teardown listeners
  });
});
