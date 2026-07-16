import { NextResponse } from "next/server";

import { normalizeEmail } from "@/lib/accounts";
import { isAuthorizedAdmin } from "@/lib/admin";
import { sendEmail } from "@/lib/email";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

// Reject a pending request: email the applicant and delete the request.
// Admin-only.
export async function POST(request: Request) {
  if (!(await isAuthorizedAdmin(request))) {
    return NextResponse.json(
      { success: false, detail: "Unauthorized." },
      { status: 401 },
    );
  }

  let payload: { email?: unknown; request_id?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, detail: "Invalid request body." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();

  const requestId =
    typeof payload.request_id === "number" ? payload.request_id : null;
  const requestEmail =
    typeof payload.email === "string" ? normalizeEmail(payload.email) : "";

  const query = supabase.from("requests").select("id, email");
  const { data: rows, error } = await (requestId !== null
    ? query.eq("id", requestId)
    : query.eq("email", requestEmail)
  ).limit(1);

  if (error) {
    console.error("admin/reject: failed to read request:", error);
    return NextResponse.json(
      { success: false, detail: "Failed to look up the request." },
      { status: 500 },
    );
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json(
      { success: false, detail: "No matching request found." },
      { status: 404 },
    );
  }

  const row = rows[0];

  // Notify the applicant. A failure here does not block deletion.
  let warning: string | undefined;
  try {
    await sendEmail(
      normalizeEmail(row.email),
      "Your ALUG@UCI VPS request",
      "Hello,\n\n" +
        "Thank you for applying for a VPS. After reviewing your request, we " +
        "are unable to fulfill it at this time due to limited capacity.\n\n" +
        "Please feel free to apply again later. Thank you for your interest in " +
        "ALUG@UCI Community Services.",
    );
  } catch (emailError) {
    console.error("admin/reject: notification email failed:", emailError);
    warning = "Request rejected, but the notification email failed to send.";
  }

  await supabase.from("requests").delete().eq("id", row.id);

  return NextResponse.json({ success: true, warning });
}
