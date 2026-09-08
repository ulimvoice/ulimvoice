import { defineSecret } from "firebase-functions/params";

/** Shared with the bound GAS project. Keep the deployed secret name unchanged. */
export const ULIM_LEGACY_PROOF_HMAC_SECRET = defineSecret(
  "ULIM_LEGACY_PROOF_HMAC_SECRET"
);

export const ULIM_SOLAPI_TABLET_CONFIG = defineSecret("ULIM_SOLAPI_TABLET_CONFIG");
