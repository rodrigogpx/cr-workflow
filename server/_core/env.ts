const isProduction = process.env.NODE_ENV === "production";
const cookieSecret = process.env.COOKIE_SECRET ?? process.env.JWT_SECRET ?? "";

// SECURITY: Fail-fast if cookie secret is empty in production — prevents forged JWTs
if (isProduction && !cookieSecret) {
  throw new Error(
    "[SECURITY] COOKIE_SECRET (or JWT_SECRET) is not configured. " +
      "The server cannot start in production without a session signing secret."
  );
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret,
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction,
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
