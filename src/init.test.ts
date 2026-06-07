import { afterEach, describe, expect, it } from "vitest";

import { init, vycheck } from "./init";

afterEach(() => {
  window.history.replaceState({}, "", "/");
});

describe("vycheck", () => {
  it("throws before init() when there is no token", async () => {
    window.history.replaceState({}, "", "/p");
    await expect(vycheck()).rejects.toThrow(/not initialized/);
  });

  it("returns an existing token without a network call (no init needed)", async () => {
    window.history.replaceState({}, "", "/p?vyt=abc");
    await expect(vycheck()).resolves.toBe("abc");
  });

  it("initializes with origin/path/pass_params when no token is present", async () => {
    window.history.replaceState({}, "", "/checkout?ref=42&vyc=9");

    let calledUrl = "";
    let body: Record<string, unknown> = {};
    const fakeFetch: typeof globalThis.fetch = async (input, fetchInit) => {
      if (input instanceof Request) {
        calledUrl = input.url;
        body = (await input.clone().json()) as Record<string, unknown>;
      } else {
        calledUrl = String(input);
        body = JSON.parse(String(fetchInit?.body ?? "{}")) as Record<string, unknown>;
      }
      return new Response(JSON.stringify({ url: "https://hosted.example/go" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    init({ publishableKey: "pk_test_x", fetch: fakeFetch });
    const out = await vycheck({ externalTracker: "t1" });

    expect(out).toBeUndefined();
    expect(calledUrl).toContain("/v3/initialize");
    expect(body.origin).toBe(window.location.origin);
    expect(body.return_path).toBe("/checkout");
    expect(body.pass_params).toEqual({ ref: "42" }); // vyc excluded
    expect(body.external_tracker).toBe("t1");
  });
});
