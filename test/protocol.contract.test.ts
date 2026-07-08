import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import * as protocol from "../src/protocol";

// Pins the SDK's embed wire protocol (query params + postMessage types)
// against app-fe's mirrored copy, so a rename on either side fails here
// instead of silently breaking the iframe flow. Point at the app-fe file with
// APP_FE_PROTOCOL=/path/to/embedProtocol.ts; defaults to the sibling app-fe
// repo in the VerifyYou workspace. Skips (rather than fails) when the file
// isn't reachable, so a standalone SDK checkout still runs green.
const PROTOCOL_PATH =
  process.env.APP_FE_PROTOCOL ??
  resolve(process.cwd(), "../deployedV2/app-fe/src/features/Embed/embedProtocol.ts");

const hasProtocol = existsSync(PROTOCOL_PATH);
const describeIfProtocol = hasProtocol ? describe : describe.skip;

function appFeConstants(): Record<string, string> {
  const source = readFileSync(PROTOCOL_PATH, "utf8");
  const constants: Record<string, string> = {};
  for (const match of source.matchAll(/export const (\w+) = "([^"]*)"/g)) {
    constants[match[1]] = match[2];
  }
  return constants;
}

describeIfProtocol("embed protocol contract (app-fe embedProtocol.ts)", () => {
  const theirs = appFeConstants();
  const ours = Object.entries(protocol).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );

  it("app-fe declares every constant the SDK relies on, with the same value", () => {
    for (const [name, value] of ours) {
      expect(theirs, `app-fe is missing ${name}`).toHaveProperty(name);
      expect(theirs[name], name).toBe(value);
    }
  });

  it("every SDK-appended query param is vy-prefixed (app-fe reserves the prefix)", () => {
    for (const [name, value] of ours) {
      if (name.endsWith("_PARAM")) {
        expect(value.startsWith("vy"), `${name}=${value}`).toBe(true);
      }
    }
  });
});
