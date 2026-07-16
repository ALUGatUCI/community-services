import { NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", sessionCookieOptions(0));
  return response;
}
