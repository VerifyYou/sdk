import { beforeEach, describe, expect, it, vi } from "vitest";

// Verify the JWT structure/claims logic without real Ed25519: stub the key
// fetch + the signature check, keep the real base64url decoding.
vi.mock("./jwks", () => ({ getVerificationKey: vi.fn().mockResolvedValue({} as CryptoKey) }));
vi.mock("./crypto", async () => {
  const actual = await vi.importActual<typeof import("./crypto")>("./crypto");
  return { ...actual, verifyEd25519: vi.fn().mockResolvedValue(true) };
});

import { verifyEd25519 } from "./crypto";
import { readTokenFromUrl, verifyToken } from "./token";

const b64url = (o: unknown): string => Buffer.from(JSON.stringify(o)).toString("base64url");
const SIG = Buffer.from("signature-bytes").toString("base64url");
const makeToken = (header: object, payload: object): string =>
  `${b64url(header)}.${b64url(payload)}.${SIG}`;
const VALID_HEADER = { alg: "EdDSA", kid: "key-1" };
const nowSec = () => Math.floor(Date.now() / 1000);

describe("verifyToken() — EdDSA / JWKS contract", () => {
  beforeEach(() => vi.mocked(verifyEd25519).mockResolvedValue(true));

  it("returns the payload for a valid, unexpired, well-signed token", async () => {
    const token = makeToken(VALID_HEADER, { sub: "guest_1", exp: nowSec() + 60 });
    await expect(verifyToken(token)).resolves.toMatchObject({ sub: "guest_1" });
  });

  it("rejects a non-EdDSA algorithm", async () => {
    await expect(verifyToken(makeToken({ alg: "HS256", kid: "k" }, {}))).rejects.toThrow(/alg/);
  });

  it("rejects a token whose header is missing kid", async () => {
    await expect(verifyToken(makeToken({ alg: "EdDSA" }, {}))).rejects.toThrow(/kid/);
  });

  it("rejects a malformed (not 3-part) token", async () => {
    await expect(verifyToken("not.a.valid.jwt.shape")).rejects.toThrow();
    await expect(verifyToken("onlyonepart")).rejects.toThrow(/compact JWT/);
  });

  it("rejects an expired token", async () => {
    await expect(verifyToken(makeToken(VALID_HEADER, { exp: nowSec() - 5 }))).rejects.toThrow(
      /expired/,
    );
  });

  it("rejects a not-yet-valid token (nbf in the future)", async () => {
    await expect(verifyToken(makeToken(VALID_HEADER, { nbf: nowSec() + 60 }))).rejects.toThrow();
  });

  it("rejects when the signature does not verify", async () => {
    vi.mocked(verifyEd25519).mockResolvedValue(false);
    await expect(verifyToken(makeToken(VALID_HEADER, {}))).rejects.toThrow(/signature/);
  });
});

describe("readTokenFromUrl()", () => {
  it("reads the vy_token query param", () => {
    expect(readTokenFromUrl("https://shop.example.com/back?vy_token=a.b.c")).toBe("a.b.c");
  });

  it("returns null when the param is absent", () => {
    expect(readTokenFromUrl("https://shop.example.com/back")).toBeNull();
  });
});
