import { NextResponse } from "next/server";

import { normalizeEmail } from "@/lib/accounts";
import { isAuthorizedAdmin } from "@/lib/admin";
import { unsuspendContainer } from "@/lib/containerApi";
import { getNodeForEmail } from "@/lib/nodes";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

// Unsuspend an account: unfreeze its container and re-enable login
// (banned = false). Admin-only.
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

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("accounts")
    .update({ banned: false })
    .eq("email", email)
    .select("email");

  if (error) {
    console.error("admin/unsuspend error:", error);
    return NextResponse.json(
      { success: false, detail: "Failed to unsuspend the account." },
      { status: 500 },
    );
  }
  if (!data || data.length === 0) {
    return NextResponse.json(
      { success: false, detail: "No account with that email." },
      { status: 404 },
    );
  }

  // Unfreeze the container (best-effort).
  let warning: string | undefined;
  const node = await getNodeForEmail(email);
  if (!node) {
    warning = "Login re-enabled, but the container's node could not be resolved.";
  } else {
    try {
      const response = await unsuspendContainer(
        node.address,
        node.secretKey,
        node.ucinetid,
      );
      if (!response.ok) {
        warning = "Login re-enabled, but unfreezing the container failed.";
      }
    } catch (error) {
      console.error("admin/unsuspend container error:", error);
      warning = "Login re-enabled, but the node was unreachable.";
    }
  }

  return NextResponse.json({ success: true, warning });
}
