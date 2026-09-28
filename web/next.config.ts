import type { NextConfig } from "next";

/**
 * CORS is NOT configured here.
 *
 * This file previously stamped every `/api/*` response with
 * `Access-Control-Allow-Origin: *` alongside `Access-Control-Allow-Credentials: true`.
 * That pair is invalid per the Fetch spec — browsers reject `*` when credentials
 * are allowed — and the obvious remediation (reflecting the request Origin) would
 * have credentialed every origin on the internet, making the `token` cookie
 * replayable from any site.
 *
 * The policy now lives in `src/lib/cors.ts`, which emits an origin only when it
 * matches the `ALLOWED_ORIGINS` allowlist. It is applied per-route via
 * `buildCorsHeaders(req)` because it depends on the request's Origin header,
 * which a static config entry cannot see.
 *
 * Cache-Control is intentionally NOT set globally either — the play routes set
 * `no-store` per-response, and applying it here would also disable caching for
 * the immutable `/_next/static/*` build assets, which are content-hashed.
 */
const nextConfig: NextConfig = {};

export default nextConfig;

