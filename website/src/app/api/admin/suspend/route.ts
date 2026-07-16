import { NextResponse } from "next/server";

import { normalizeEmail } from "@/lib/accounts";
import { isAuthorizedAdmin } from "@/lib/admin";
import { suspendContainer } from "@/lib/containerApi";
import { getNodeForEmail } from "@/lib/nodes";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

// Suspend an account: block login (banned = true) and freeze its container.
// Admin-only.
export async function POST(request: Request) {
  if (!(await isAuthorizedAdmin(request))) {
    return NextResponse.json(
      { success: false, detail: "Unauthorized." },
      { status: 401 },
    );
  }

  let payload: { email?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, detail: "Invalid request body." },
      { status: 400 },
    );
  }

  const email = typeof payload.email === "string" ? normalizeEmail(payload.email) : "";
  if (!email) {
    return NextResponse.json(
      { success: false, detail: "An email is required." },
      { status: 400 },
    );
  }

  // Block login first so the ban takes effect even if the freeze fails.
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("accounts")
    .update({ banned: true })
    .eq("email", email)
    .select("email");

  if (error) {
    console.error("admin/suspend error:", error);
    return NextResponse.json(
      { success: false, detail: "Failed to suspend the account." },
      { status: 500 },
    );
  }
  if (!data || data.length === 0) {
    return NextResponse.json(
      { success: false, detail: "No account with that email." },
      { status: 404 },
    );
  }

  // Freeze the container (best-effort).
  let warning: string | undefined;
  const node = await getNodeForEmail(email);
  if (!node) {
    warning = "Login blocked, but the container's node could not be resolved.";
  } else {
    try {
      const response = await suspendContainer(
        node.address,
        node.secretKey,
        node.ucinetid,
      );
      if (!response.ok) {
        warning = "Login blocked, but freezing the container failed.";
      }
    } catch (error) {
      console.error("admin/suspend container error:", error);
      warning = "Login blocked, but the node was unreachable.";
    }
  }

  return NextResponse.json({ success: true, warning });
}
