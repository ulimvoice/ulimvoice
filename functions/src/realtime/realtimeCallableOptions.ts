import { ULIM_FUNCTION_REGION } from "../common/firebaseRegion.js";

export const ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS = Object.freeze({
  region: ULIM_FUNCTION_REGION,
  cors: true,
  invoker: "public" as const
});
