import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// Pins the SDK's /v3/initialize assumptions against connect-service's actual
// OpenAPI, so a backend reshape that would break the SDK fails here instead of
// in production. Point at a spec with CONNECT_OPENAPI=/path/to/openapi.json;
// defaults to the sibling connect-service repo in the VerifyYou workspace.
// Skips (rather than fails) when the spec isn't reachable, so a standalone SDK
// checkout / CI without the monorepo still runs green.
const SPEC_PATH =
  process.env.CONNECT_OPENAPI ??
  resolve(process.cwd(), "../deployedV2/connect-service/openapi.json");

const hasSpec = existsSync(SPEC_PATH);
const describeIfSpec = hasSpec ? describe : describe.skip;

interface Schema {
  $ref?: string;
  properties?: Record<string, unknown>;
}
interface Spec {
  paths: Record<string, { post?: { requestBody?: any; responses?: any } }>;
  components: { schemas: Record<string, Schema> };
}

const spec: Spec | null = hasSpec
  ? (JSON.parse(readFileSync(SPEC_PATH, "utf8")) as Spec)
  : null;

function deref(schema: Schema | undefined): Schema {
  if (schema?.$ref) {
    const name = schema.$ref.split("/").pop() as string;
    return spec!.components.schemas[name] as Schema;
  }
  return schema ?? {};
}

describeIfSpec("/v3/initialize contract (connect-service OpenAPI)", () => {
  const op = spec?.paths["/v3/initialize"]?.post;

  it("is still a POST endpoint", () => {
    expect(op).toBeDefined();
  });

  it("accepts the request fields the SDK sends (origin, return_path)", () => {
    const req = deref(op!.requestBody.content["application/json"].schema);
    expect(Object.keys(req.properties ?? {})).toEqual(
      expect.arrayContaining(["origin", "return_path"]),
    );
  });

  it("returns the `url` the SDK reads from the response", () => {
    const resp = deref(op!.responses["200"].content["application/json"].schema);
    expect(Object.keys(resp.properties ?? {})).toContain("url");
  });
});

if (!hasSpec) {
  describe("/v3/initialize contract", () => {
    it.skip(`skipped — connect-service spec not found at ${SPEC_PATH}`, () => {});
  });
}
