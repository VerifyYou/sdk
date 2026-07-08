import { init, vycheck, vyget, verify, claim } from "./index";

// Exposed as the global `VerifyYou` over the CDN build:
//   VerifyYou.init({ publishableKey })                  // default redirect flow
//   VerifyYou.init({ publishableKey, mode: "iframe" })  // opt into the iframe
//   await VerifyYou.vycheck()                            // start (redirect/iframe)
//   VerifyYou.vyget()                                    // read the result
//   VerifyYou.verify({ ... })                            // direct iframe primitive
export default { init, vycheck, vyget, verify, claim };
