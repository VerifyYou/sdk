import { verify, claim } from "./index";

// Exposed as the global `VerifyYou` over the CDN build:
//   VerifyYou.verify({ email })
//   VerifyYou.claim()
export default { verify, claim };
