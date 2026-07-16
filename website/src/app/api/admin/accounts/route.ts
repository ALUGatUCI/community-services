import { NextResponse } from "next/server";

import { normalizeEmail } from "@/lib/accounts";
import { isAuthorizedAdmin } from "@/lib/admin";
import { deleteContainer } from "@/lib/containerApi";
import { getNodeForEmail } from "@/lib/nodes";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

// List accounts. Admin-only.
export async function GET(request: Request) {
  if (!(await isAuthorizedAdmin(request))) {
    return NextResponse.json(
      { success: false, detail: "Unauthorized." },
      { status: 401 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("accounts")
    .select("email, container_ip, banned, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("admin/accounts GET error:", error);
    return NextResponse.json(
      { success: false, detail: "Failed to load accounts." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, accounts: data ?? [] });
}

// Delete an account (via ?email=) and its container. Admin-only.
export async function DELETE(request: Request) {
  if (!(await isAuthorizedAdmin(request))) {
    return NextResponse.json(
      { success: false, detail: "Unauthorized." },
      { status: 401 },
    );
  }

  const email = normalizeEmail(
    new URL(request.url).searchParams.get("email") ?? "",
  );
  if (!email) {
    return NextResponse.json(
      { success: false, detail: "An email is required." },
      { status: 400 },
    );
  }

  // Tear down the container first (best-effort), then remove the account row.
  let warning: string | undefined;
  const node = await getNodeForEmail(email);
  if (!node) {
    warning = "Account removed, but its node/container could not be resolved.";
  } else {
    try {
      const response = await deleteContainer(
        node.address,
        node.secretKey,
        node.ucinetid,
      );
      if (!response.ok) {
        warning = "Account removed, but deleting the container failed.";
      }
    } catch (error) {
      console.error("admin/accounts DELETE container error:", error);
      warning = "Account removed, but the node was unreachable.";
    }
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("accounts")
    .delete()
    .eq("email", email)
    .select("email");

  if (error) {
    console.error("admin/accounts DELETE error:", error);
    return NextResponse.json(
      { success: false, detail: "Failed to delete the account." },
      { status: 500 },
    );
  }
  if (!data || data.length === 0) {
    return NextResponse.json(
      { success: false, detail: "No account with that email." },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, warning });
}
