import "server-only";

import { timingSafeEqual } from "crypto";

import { hasAdminSession } from "./session";

// True if the request presents the shared admin secret in the `x-admin-key`
// header. Used for scripts/automation.
export function hasAdminKey(request: Request): boolean {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) return false;

  const provided = request.headers.get("x-admin-key") ?? "";
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);

  return (
    expectedBuf.length === providedBuf.length &&
    timingSafeEqual(expectedBuf, providedBuf)
  );
}

// Verify the admin secret directly (used by the admin login endpoint).
export function verifyAdminSecret(secret: string): boolean {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) return false;

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(secret);

  return (
    expectedBuf.length === providedBuf.length &&
    timingSafeEqual(expectedBuf, providedBuf)
  );
}

// Authorize an admin request via either the header key or an admin session
// cookie (set by logging into the admin page).
export async function isAuthorizedAdmin(request: Request): Promise<boolean> {
  if (hasAdminKey(request)) return true;
  return hasAdminSession();
}
