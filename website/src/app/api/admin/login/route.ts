import { NextResponse } from "next/server";

import { verifyAdminSecret } from "@/lib/admin";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  createAdminToken,
  sessionCookieOptions,
} from "@/lib/session";

// Exchange the shared admin secret for a short-lived admin session cookie.
export async function POST(request: Request) {
  let payload: { secret?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, detail: "Invalid request body." },
      { status: 400 },
    );
  }

  const secret = typeof payload.secret === "string" ? payload.secret : "";
  if (!verifyAdminSecret(secret)) {
    return NextResponse.json(
      { success: false, detail: "Invalid admin secret." },
      { status: 401 },
    );
  }

  const token = await createAdminToken();
  const response = NextResponse.json({ success: true });
  response.cookies.set(
    ADMIN_SESSION_COOKIE,
    token,
    sessionCookieOptions(ADMIN_SESSION_TTL_SECONDS),
  );
  return response;
}
