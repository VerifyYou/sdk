import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "./index";
import cdn from "./cdn";
import { VerifyYouError, init, vycheck, vyget } from "./index";

// This publishes as a BETA and existing integrators are on the stable API.
// These guard the public surface so an accidental removal/rename fails CI
// before publish, and pin that the new vycheck({ session }) option is strictly
// additive — the existing call forms behave byte-for-byte as before.

describe("backwards compatibility — stable public surface", () => {
  it("exposes exactly init / vycheck / vyget / VerifyYouError as runtime exports", () => {
    // Type-only exports (InitConfig, VyResult, …) have no runtime key, so the
    // runtime surface is exactly these four. openSession was folded into
    // vycheck({ session }) and must NOT reappear as its own export.
    expect(Object.keys(api).sort()).toEqual(["VerifyYouError", "init", "vycheck", "vyget"]);
    expect("openSession" in api).toBe(false);
  });

  it("keeps init / vycheck / vyget as callable functions", () => {
    expect(typeof init).toBe("function");
    expect(typeof vycheck).toBe("function");
    expect(typeof vyget).toBe("function");
  });

  it("keeps VerifyYouError constructing with the (message, code, status) shape", () => {
    const err = new VerifyYouError("boom", "http", 500);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("VerifyYouError");
    expect(err.message).toBe("boom");
    expect(err.code).toBe("http");
    expect(err.status).toBe(500);
  });

  it("exposes exactly init / vycheck / vyget on the CDN global (no openSession)", () => {
    expect(Object.keys(cdn).sort()).toEqual(["init", "vycheck", "vyget"]);
    expect(typeof cdn.init).toBe("function");
    expect(typeof cdn.vycheck).toBe("function");
    expect(typeof cdn.vyget).toBe("function");
  });
});

describe("backwards compatibility — vyget() return shape unchanged", () => {
  beforeEach(() => window.history.replaceState({}, "", "/"));
  afterEach(() => window.history.replaceState({}, "", "/"));

  it("returns { token, verified, vyc } — empty when no return params", () => {
    expect(vyget()).toEqual({ token: null, verified: false, vyc: null });
  });

  it("returns { token, verified, vyc } — populated from ?vyt/?vyc", () => {
    window.history.replaceState({}, "", "/?vyt=tok&vyc=1");
    expect(vyget()).toEqual({ token: "tok", verified: true, vyc: "1" });
  });
});

describe("backwards compatibility — vycheck({ session }) is strictly opt-in", () => {
  function mockInitialize() {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ url: "https://app.localhost/verification/abc" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("omitting session preserves today's behavior: vycheck() still calls /v3/initialize", async () => {
    const fetchMock = mockInitialize();
    init({ publishableKey: "pk_test_1", connectBase: "http://localhost:8090" });
    void vycheck().catch(() => {});
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [calledUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("/v3/initialize");
  });

  it("supplying session skips /v3/initialize entirely (iframe display)", async () => {
    const fetchMock = mockInitialize();
    const container = document.createElement("div");
    document.body.appendChild(container);
    init({ publishableKey: "pk_test_1", mode: "iframe", display: "inline", container });
    void vycheck({ session: "sess_def" }).catch(() => {});
    await vi.waitFor(() => {
      if (!container.querySelector("iframe")?.getAttribute("src")) throw new Error("not mounted");
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
