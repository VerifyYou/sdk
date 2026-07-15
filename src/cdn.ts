import { init, vycheck, vyget } from "./index";

// Exposed as the global `VerifyYou` over the CDN build:
//   VerifyYou.init({ publishableKey })                  // default redirect flow
//   VerifyYou.init({ publishableKey, mode: "iframe" })  // opt into the iframe
//   await VerifyYou.vycheck()                            // start (redirect/iframe)
//   await VerifyYou.vycheck({ session })                 // open a pre-initialized session
//   VerifyYou.vyget()                                    // read the result
export default { init, vycheck, vyget };
