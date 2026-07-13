import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { init, vycheck, vyget } from "./client";

// The redirect flow's return contract: the hosted app appends ?vyt=<token> and
// ?vyc=<1|0> to the partner's return URL, and vyget() reads them back.
describe("vyget() — redirect return params (?vyt / ?vyc)", () => {
  beforeEach(() => window.history.replaceState({}, "", "/"));

  it("parses ?vyt + ?vyc=1 as a verified result", () => {
    window.history.replaceState({}, "", "/?vyt=tok_123&vyc=1");
    expect(vyget()).toEqual({ token: "tok_123", verified: true, vyc: "1" });
  });

  it("treats ?vyc=0 as not verified", () => {
    window.history.replaceState({}, "", "/?vyt=tok&vyc=0");
    expect(vyget()).toEqual({ token: "tok", verified: false, vyc: "0" });
  });

  it("returns an empty result when no return params are present", () => {
    expect(vyget()).toEqual({ token: null, verified: false, vyc: null });
  });
});

// vycheck() feeds initialize() from the init-time config merged with per-call
// overrides (overrides win). These pin that the per-run `config` override rides
// that merge into the POST /v3/initialize body in both modes.
describe("vycheck() — config passthrough to /v3/initialize", () => {
  function mockInitialize() {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ url: "https://app.localhost/verification/abc" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  function sentBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    return JSON.parse(init.body as string) as Record<string, unknown>;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("redirect mode sends the init-time config", async () => {
    const fetchMock = mockInitialize();
    const config = { skip_check: true };
    init({ publishableKey: "pk_test_1", connectBase: "http://localhost:8090", config });
    void vycheck().catch(() => {}); // never resolves: redirect navigates away
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(sentBody(fetchMock).config).toEqual(config);
  });

  it("a per-call config override beats the init-time value", async () => {
    const fetchMock = mockInitialize();
    init({
      publishableKey: "pk_test_1",
      connectBase: "http://localhost:8090",
      config: { skip_check: true },
    });
    void vycheck({ config: { allow_decline: false } }).catch(() => {});
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(sentBody(fetchMock).config).toEqual({ allow_decline: false });
  });

  it("omits config when neither init nor the call provides one", async () => {
    const fetchMock = mockInitialize();
    init({ publishableKey: "pk_test_1", connectBase: "http://localhost:8090" });
    void vycheck().catch(() => {});
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(Object.keys(sentBody(fetchMock))).not.toContain("config");
  });

  it("iframe drawer honors the init-time theme (rides through verify())", async () => {
    mockInitialize();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
    init({
      publishableKey: "pk_test_1",
      connectBase: "http://localhost:8090",
      mode: "iframe",
      theme: "dark",
    });
    const check = vycheck();
    const card = document.body.lastElementChild?.lastElementChild as HTMLElement;
    expect(card.style.background).toBe("rgb(13, 15, 18)");
    // Settle the pending session so its message listener doesn't leak.
    await vi.waitFor(() => {
      if (!document.querySelector("iframe")?.src) throw new Error("iframe not pointed yet");
    });
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://app.localhost",
        data: { type: "vy:close" },
      }),
    );
    await check;
  });

  it("iframe mode forwards the per-call config through verify()", async () => {
    const fetchMock = mockInitialize();
    const container = document.createElement("div");
    document.body.appendChild(container);
    init({
      publishableKey: "pk_test_1",
      connectBase: "http://localhost:8090",
      mode: "iframe",
      display: "inline",
      container,
    });
    const config = { identity: { mode: "anonymous" } };
    void vycheck({ config }).catch(() => {});
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(sentBody(fetchMock).config).toEqual(config);
  });
});
