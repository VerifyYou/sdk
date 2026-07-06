/**
 * Wire protocol between this SDK and the embedded app-fe. app-fe keeps a
 * mirrored copy (`src/features/Embed/embedProtocol.ts`); the contract test in
 * `test/protocol.contract.test.ts` pins the two against each other — change
 * both sides together.
 */

export const EMBED_PARAM = "vy_embed";
export const EMBED_ORIGIN_PARAM = "vy_origin";
export const EMBED_EMAIL_PARAM = "vy_email";
export const EMBED_PHONE_PARAM = "vy_phone";

/** Query params the backend appends to partner redirect URLs. */
export const VERDICT_TOKEN_PARAM = "vyt";
export const VERDICT_CODE_PARAM = "vyc";

export const EMBED_MSG_COMPLETE = "vy:complete";
export const EMBED_MSG_CLOSE = "vy:close";
export const EMBED_MSG_RESIZE = "vy:resize";
