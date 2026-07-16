import { NextResponse } from "next/server";

import { isAuthorizedAdmin } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

async function requireAdmin(request: Request): Promise<NextResponse | null> {
  if (!(await isAuthorizedAdmin(request))) {
    return NextResponse.json(
      { success: false, detail: "Unauthorized." },
      { status: 401 },
    );
  }
  return null;
}

function cleanAddress(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// List nodes. Secret keys are never returned — only whether one is set.
export async function GET(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("nodes")
    .select("address, secret_key")
    .order("address", { ascending: true });

  if (error) {
    console.error("admin/nodes GET error:", error);
    return NextResponse.json(
      { success: false, detail: "Failed to load nodes." },
      { status: 500 },
    );
  }

  const nodes = (data ?? []).map((row) => ({
    address: row.address as string,
    has_secret_key: !!row.secret_key,
  }));
  return NextResponse.json({ success: true, nodes });
}

// Add a node.
export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  let payload: { address?: unknown; secret_key?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, detail: "Invalid request body." },
      { status: 400 },
    );
  }

  const address = cleanAddress(payload.address);
  if (!address || /\s/.test(address)) {
    return NextResponse.json(
      { success: false, detail: "A valid node address is required." },
      { status: 400 },
    );
  }
  const secretKey =
    typeof payload.secret_key === "string" && payload.secret_key.trim()
      ? payload.secret_key.trim()
      : null;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("nodes")
    .insert({ address, secret_key: secretKey });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { success: false, detail: "A node with that address already exists." },
        { status: 409 },
      );
    }
    console.error("admin/nodes POST error:", error);
    return NextResponse.json(
      { success: false, detail: "Failed to add the node." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}

// Update a node's secret key (rotate/set/clear). An empty key clears it.
export async function PATCH(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  let payload: { address?: unknown; secret_key?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, detail: "Invalid request body." },
      { status: 400 },
    );
  }

  const address = cleanAddress(payload.address);
  if (!address) {
    return NextResponse.json(
      { success: false, detail: "A node address is required." },
      { status: 400 },
    );
  }
  const secretKey =
    typeof payload.secret_key === "string" && payload.secret_key.trim()
      ? payload.secret_key.trim()
      : null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("nodes")
    .update({ secret_key: secretKey })
    .eq("address", address)
    .select("address");

  if (error) {
    console.error("admin/nodes PATCH error:", error);
    return NextResponse.json(
      { success: false, detail: "Failed to update the node." },
      { status: 500 },
    );
  }
  if (!data || data.length === 0) {
    return NextResponse.json(
      { success: false, detail: "No node with that address." },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true });
}

// Delete a node (via ?address=). Blocked if accounts still reference it.
export async function DELETE(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const address = cleanAddress(new URL(request.url).searchParams.get("address"));
  if (!address) {
    return NextResponse.json(
      { success: false, detail: "A node address is required." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("nodes")
    .delete()
    .eq("address", address)
    .select("address");

  if (error) {
    // 23503 = foreign_key_violation: accounts still point at this node.
    if (error.code === "23503") {
      return NextResponse.json(
        {
          success: false,
          detail: "This node still has accounts and cannot be deleted.",
        },
        { status: 409 },
      );
    }
    console.error("admin/nodes DELETE error:", error);
    return NextResponse.json(
      { success: false, detail: "Failed to delete the node." },
      { status: 500 },
    );
  }
  if (!data || data.length === 0) {
    return NextResponse.json(
      { success: false, detail: "No node with that address." },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true });
}
