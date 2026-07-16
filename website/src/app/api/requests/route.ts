import { NextResponse } from "next/server";

import { accountExists } from "@/lib/accounts";
import { validateRequest } from "@/lib/requests";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

// Handles anonymous VPS requests: validates the payload and inserts a row into
// the Supabase `requests` table. No authentication is required.
export async function POST(request: Request) {
  let payload: { email?: unknown; reason?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, detail: "Invalid request body." },
      { status: 400 },
    );
  }

  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";

  const validationError = validateRequest({ email, reason });
  if (validationError) {
    return NextResponse.json(
      { success: false, detail: validationError },
      { status: 400 },
    );
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (error) {
    console.error("Supabase configuration error:", error);
    return NextResponse.json(
      { success: false, detail: "The request service is not configured." },
      { status: 500 },
    );
  }

  // Reject requests from emails that already have an account.
  try {
    if (await accountExists(email)) {
      return NextResponse.json(
        {
          success: false,
          detail: "An account already exists for this email.",
        },
        { status: 409 },
      );
    }
  } catch (error) {
    console.error("Failed to check for existing account:", error);
    return NextResponse.json(
      { success: false, detail: "Failed to submit your request." },
      { status: 500 },
    );
  }

  const { error } = await supabase.from("requests").insert({
    email,
    reason,
    created_at: new Date().toISOString(),
  });

  if (error) {
    // 23505 = unique_violation: this email already has a request on file.
    if (error.code === "23505") {
      return NextResponse.json(
        {
          success: false,
          detail: "A request has already been submitted for this email.",
        },
        { status: 409 },
      );
    }

    console.error("Failed to insert request:", error);
    return NextResponse.json(
      { success: false, detail: "Failed to submit your request." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
