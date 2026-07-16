import { NextResponse } from "next/server";

import { isAuthorizedAdmin } from "@/lib/admin";
import { getNodeAtLimit } from "@/lib/containerApi";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

// Check that a node is reachable and its stored key is accepted, reporting
// whether it currently has capacity. Admin-only.
export async function POST(request: Request) {
  if (!(await isAuthorizedAdmin(request))) {
    return NextResponse.json(
      { success: false, detail: "Unauthorized." },
      { status: 401 },
    );
  }

  let payload: { address?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, detail: "Invalid request body." },
      { status: 400 },
    );
  }

  const address = typeof payload.address === "string" ? payload.address.trim() : "";
  if (!address) {
    return NextResponse.json(
      { success: false, detail: "A node address is required." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("nodes")
    .select("secret_key")
    .eq("address", address)
    .limit(1);

  if (error) {
    console.error("admin/nodes/test error:", error);
    return NextResponse.json(
      { success: false, detail: "Failed to look up the node." },
      { status: 500 },
    );
  }
  if (!data || data.length === 0) {
    return NextResponse.json(
      { success: false, detail: "No node with that address." },
      { status: 404 },
    );
  }

  const secretKey = (data[0].secret_key as string | null) ?? null;
  if (!secretKey) {
    return NextResponse.json({
      success: true,
      reachable: false,
      atLimit: null,
      detail: "No secret key set for this node.",
    });
  }

  const { reachable, atLimit } = await getNodeAtLimit(address, secretKey);
  return NextResponse.json({
    success: true,
    reachable,
    atLimit: reachable ? atLimit : null,
  });
}
