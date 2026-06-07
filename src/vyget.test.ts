import { afterEach, describe, expect, it } from "vitest";

import { vyget } from "./vyget";

function setUrl(search: string): void {
  window.history.replaceState({}, "", `/page${search}`);
}

afterEach(() => setUrl(""));

describe("vyget", () => {
  it("reads an approved verdict and the token", () => {
    setUrl("?vyc=1&vyt=tok123");
    expect(vyget()).toEqual({ verified: true, token: "tok123" });
  });

  it("reads a denied verdict", () => {
    setUrl("?vyc=0");
    expect(vyget()).toEqual({ verified: false, token: undefined });
  });

  it("is undefined when params are absent", () => {
    setUrl("");
    expect(vyget()).toEqual({ verified: undefined, token: undefined });
  });
});
