export const COOKIE_NAME = "app_session_id";
export const PLATFORM_COOKIE_NAME = "platform_session_id_v2"; // v2: session cookie (sem maxAge), 8h JWT — invalida cookies antigos de 30 dias
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365; // Mantido para compatibilidade — não usar em novas sessões
export const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 dias (substituiu ONE_YEAR_MS nas sessões de auth)
export const PLATFORM_SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 8; // 8 horas — platform admin (session cookie: apagado ao fechar o browser)
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = "Please login (10001)";
export const NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
