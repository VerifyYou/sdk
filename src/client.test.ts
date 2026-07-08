import { beforeEach, describe, expect, it } from "vitest";

import { vyget } from "./client";

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
