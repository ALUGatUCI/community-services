import { NextResponse } from "next/server";

import { isAuthorizedAdmin } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

// List pending VPS requests, oldest first. Admin-only.
export async function GET(request: Request) {
  if (!(await isAuthorizedAdmin(request))) {
    return NextResponse.json(
      { success: false, detail: "Unauthorized." },
      { status: 401 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("requests")
    .select("id, email, reason, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("admin/requests error:", error);
    return NextResponse.json(
      { success: false, detail: "Failed to load requests." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, requests: data ?? [] });
}
