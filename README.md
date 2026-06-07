# @verifyyou-sdk/client

Verify a real, unique human with two calls — from the browser or your server.

- **`init(config)`** — configure once (publishable key, optional base URL).
- **`vycheck()`** — start a verification: returns the token if the user already came back, otherwise redirects them to the hosted flow.
- **`vyget()`** — synchronously read the result (`{ verified, token }`) off the return URL.

Ships ESM, a UMD build for `<script>` tags, and full TypeScript types.

## Install

```bash
npm install @verifyyou-sdk/client
# or: pnpm add @verifyyou-sdk/client
```

## Quick start (TypeScript / bundler)

```ts
import { init, vyget, vycheck } from "@verifyyou-sdk/client";

init({ publishableKey: "pk_live_…" }); // once, at app startup

// When the user lands back on your page after verifying:
const { verified, token } = vyget();
// `verified` is the quick client-side verdict; `token` is the proof to verify
// server-side (see below). If neither is present, kick off verification:
if (!token) {
  await vycheck(); // redirects to the hosted flow, then back to this page
}
```

## Quick start (no build step, `<script>`)

```html
<script src="https://unpkg.com/@verifyyou-sdk/client"></script>
<script>
  Vy.init({ publishableKey: "pk_live_…" });
  if (!Vy.vyget().token) Vy.vycheck();
</script>
```

## Verifying server-side (recommended)

`vyget().verified` is a convenience for the UI. For anything that matters, send the
`token` to your backend and confirm it with your **secret** key:

```ts
import { init, externalGetConfirmation } from "@verifyyou-sdk/client";

init({ secretKey: process.env.VERIFYYOU_SECRET_KEY });

const { data } = await externalGetConfirmation({
  path: { token },
  throwOnError: true,
});
// data => { verified, external_id, verification: { external_id, external_tenant_id } }
```

The full typed API (create/list/lookup/update verifications, lock confirmations, …) is
exported the same way — configure it once with `init({ secretKey })`.

## Configuration

`init(config)` accepts:

| option           | type           | notes                                                            |
| ---------------- | -------------- | ---------------------------------------------------------------- |
| `publishableKey` | `string`       | `pk_*` — browser use.                                            |
| `secretKey`      | `string`       | `sk_*` — server-side only. Never ship a secret key to a browser. |
| `baseUrl`        | `string`       | Override the API base. Defaults to production.                   |
| `fetch`          | `typeof fetch` | Custom fetch (SSR / tests).                                      |

The base URL can also be set via the `VERIFYYOU_API_URL` environment variable
(an explicit `baseUrl` wins).

## API

- `init(config): void` — set the key + base URL on the shared client. Call before `vycheck()`.
- `vyget(): { verified: boolean | undefined; token: string | undefined }` — read the
  `vyc` verdict and `vyt` token from the current URL. Safe to call anywhere.
- `vycheck(opts?: { externalTracker?: string }): Promise<string | undefined>` — return the
  existing token, or start a verification for the current page and redirect to the hosted flow.

## License

MIT
