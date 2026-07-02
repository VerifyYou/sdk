import { afterEach, describe, expect, it, vi } from "vitest";

import { initialize } from "./connect";

// initialize() is the SDK's single backend dependency for starting a flow:
// POST {connectBase}/v3/initialize, Bearer <publishableKey>, {origin, return_path}
// -> { url }. These tests pin that wire contract; test/contract.test.ts pins it
// against connect-service's actual OpenAPI so backend drift is caught too.

function mockFetch(res: { ok?: boolean; status?: number; body?: unknown }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: res.ok ?? true,
    status: res.status ?? 200,
    json: async () => res.body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("initialize() — POST /v3/initialize", () => {
  it("sends the publishable key as a bearer token with origin + return_path, returns the url", async () => {
    const fetchMock = mockFetch({ body: { url: "https://app.verifyyou.com/verification/abc" } });

    const url = await initialize({
      publishableKey: "pk_test_123",
      connectBase: "http://localhost:8090",
      origin: "https://shop.example.com",
      returnPath: "/verified",
    });

    expect(url).toBe("https://app.verifyyou.com/verification/abc");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe("http://localhost:8090/v3/initialize");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer pk_test_123");
    expect(headers["content-type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({
      origin: "https://shop.example.com",
      return_path: "/verified",
    });
  });

  it("defaults return_path to '/' when not provided", async () => {
    const fetchMock = mockFetch({ body: { url: "https://x/y" } });
    await initialize({
      publishableKey: "pk_test_x",
      connectBase: "http://localhost:8090",
      origin: "https://x.com",
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ origin: "https://x.com", return_path: "/" });
  });

  it("throws when connect-service rejects the key (HTTP 401)", async () => {
    mockFetch({ ok: false, status: 401, body: {} });
    await expect(
      initialize({
        publishableKey: "pk_bad",
        connectBase: "http://localhost:8090",
        origin: "https://x.com",
      }),
    ).rejects.toThrow(/HTTP 401/);
  });

  it("throws when the response is missing the url", async () => {
    mockFetch({ body: {} });
    await expect(
      initialize({
        publishableKey: "pk_test_x",
        connectBase: "http://localhost:8090",
        origin: "https://x.com",
      }),
    ).rejects.toThrow(/no url/);
  });
});
