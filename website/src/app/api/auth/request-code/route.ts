import { NextResponse } from "next/server";

import { getAccount, normalizeEmail } from "@/lib/accounts";
import { sendEmail } from "@/lib/email";
import { issueLoginCode } from "@/lib/loginCodes";

// Step 1 of login: if an account exists for the email, email them a login code.
// The response is intentionally generic so it does not reveal whether an
// account exists for a given address.
export async function POST(request: Request) {
  let payload: { email?: unknown };
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
  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { success: false, detail: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  try {
    // Only send a code to an existing, non-suspended account.
    const account = await getAccount(email);
    if (account && !account.banned) {
      const code = await issueLoginCode(email);
      await sendEmail(
        email,
        "Your ALUG@UCI login code",
        `Your login code is: ${code}\n\n` +
          "It expires in 10 minutes. If you did not request this, you can " +
          "ignore this email.",
      );
    }
  } catch (error) {
    console.error("request-code error:", error);
    return NextResponse.json(
      { success: false, detail: "Failed to send a login code." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
