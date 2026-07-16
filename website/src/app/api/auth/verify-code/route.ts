import { NextResponse } from "next/server";

import { getAccount, normalizeEmail } from "@/lib/accounts";
import { verifyLoginCode } from "@/lib/loginCodes";
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  sessionCookieOptions,
} from "@/lib/session";

// Step 2 of login: verify the emailed code and, on success, issue a session
// cookie.
export async function POST(request: Request) {
  let payload: { email?: unknown; code?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, detail: "Invalid request body." },
      { status: 400 },
    );
  }

  const email =
    typeof payload.email === "string" ? normalizeEmail(payload.email) : "";
  const code = typeof payload.code === "string" ? payload.code.trim() : "";

  if (!email || !code) {
    return NextResponse.json(
      { success: false, detail: "Email and code are required." },
      { status: 400 },
    );
  }

  try {
    const valid = await verifyLoginCode(email, code);
    // Re-check the account still exists (it could have been removed after the
    // code was issued).
    const account = await getAccount(email);
    if (!valid || !account) {
      return NextResponse.json(
        { success: false, detail: "Invalid or expired code." },
        { status: 401 },
      );
    }
    // Suspended accounts cannot log in.
    if (account.banned) {
      return NextResponse.json(
        { success: false, detail: "This account is suspended." },
        { status: 403 },
      );
    }
  } catch (error) {
    console.error("verify-code error:", error);
    return NextResponse.json(
      { success: false, detail: "Failed to verify the code." },
      { status: 500 },
    );
  }

  const token = await createSessionToken(email);
  const response = NextResponse.json({ success: true, email });
  response.cookies.set(
    SESSION_COOKIE,
    token,
    sessionCookieOptions(SESSION_TTL_SECONDS),
  );
  return response;
}
