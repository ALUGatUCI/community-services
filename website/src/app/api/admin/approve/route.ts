import { randomBytes } from "crypto";

import { NextResponse } from "next/server";

import { accountExists, normalizeEmail } from "@/lib/accounts";
import { isAuthorizedAdmin } from "@/lib/admin";
import {
  createContainer,
  deleteContainer,
  getNodeAtLimit,
} from "@/lib/containerApi";
import { sendEmail } from "@/lib/email";
import { listNodes, type NodeRecord } from "@/lib/nodes";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

// A VPS password the user changes on first SSH login.
function generatePassword(): string {
  return randomBytes(12).toString("base64url");
}

// Approve a pending request: find a node with spare capacity, provision the
// container there, create the account, remove the request, and email the user
// their temporary credentials. Admin-only (shared secret via `x-admin-key`).
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

  // Resolve the pending request by id or email.
  const requestId =
    typeof payload.request_id === "number" ? payload.request_id : null;
  const requestEmail =
    typeof payload.email === "string" ? normalizeEmail(payload.email) : "";

  const query = supabase.from("requests").select("id, email");
  const { data: requestRows, error: requestError } = await (requestId !== null
    ? query.eq("id", requestId)
    : query.eq("email", requestEmail)
  ).limit(1);

  if (requestError) {
    console.error("approve: failed to read request:", requestError);
    return NextResponse.json(
      { success: false, detail: "Failed to look up the request." },
      { status: 500 },
    );
  }
  if (!requestRows || requestRows.length === 0) {
    return NextResponse.json(
      { success: false, detail: "No matching request found." },
      { status: 404 },
    );
  }

  const requestRow = requestRows[0];
  const email = normalizeEmail(requestRow.email);
  const ucinetid = email.split("@")[0];

  // Fail early if an account already exists, before provisioning anything.
  if (await accountExists(email)) {
    return NextResponse.json(
      { success: false, detail: "An account already exists for this email." },
      { status: 409 },
    );
  }

  const nodes = await listNodes();
  if (nodes.length === 0) {
    return NextResponse.json(
      { success: false, detail: "No nodes are configured." },
      { status: 503 },
    );
  }

  const password = generatePassword();

  // Walk the nodes: skip any that lack a key, are unreachable, or are at
  // capacity, and provision on the first one that accepts the container. Each
  // node is authenticated with its own secret_key.
  let selectedNode: NodeRecord | null = null;
  for (const node of nodes) {
    if (!node.secretKey) {
      console.warn(`approve: node ${node.address} has no secret_key, skipping`);
      continue;
    }

    const { reachable, atLimit } = await getNodeAtLimit(
      node.address,
      node.secretKey,
    );
    if (!reachable || atLimit) continue;

    let createResponse: Response;
    try {
      createResponse = await createContainer(
        node.address,
        node.secretKey,
        ucinetid,
        password,
      );
    } catch (error) {
      console.error(`approve: node ${node.address} unreachable on create:`, error);
      continue;
    }

    if (createResponse.ok) {
      selectedNode = node;
      break;
    }
    if (createResponse.status === 409) {
      return NextResponse.json(
        { success: false, detail: "A container already exists for this account." },
        { status: 409 },
      );
    }
    // 503 means the node filled between the check and create — try the next.
    if (createResponse.status !== 503) {
      console.error(
        `approve: node ${node.address} create failed (${createResponse.status})`,
      );
    }
  }

  if (!selectedNode) {
    return NextResponse.json(
      { success: false, detail: "No node with available capacity was found." },
      { status: 503 },
    );
  }

  // Record the account. If this fails, tear the container back down so we don't
  // leave an orphaned instance.
  const { error: accountError } = await supabase.from("accounts").insert({
    email,
    container_ip: selectedNode.address,
    created_at: new Date().toISOString(),
  });

  if (accountError) {
    await deleteContainer(
      selectedNode.address,
      selectedNode.secretKey!,
      ucinetid,
    ).catch((error) =>
      console.error("approve: rollback delete failed:", error),
    );
    if (accountError.code === "23505") {
      return NextResponse.json(
        { success: false, detail: "An account already exists for this email." },
        { status: 409 },
      );
    }
    console.error("approve: failed to insert account:", accountError);
    return NextResponse.json(
      { success: false, detail: "Failed to create the account." },
      { status: 500 },
    );
  }

  // Remove the now-fulfilled request.
  await supabase.from("requests").delete().eq("id", requestRow.id);

  // Notify the user. A failure here does not undo the approval.
  let warning: string | undefined;
  try {
    await sendEmail(
      email,
      "Your ALUG@UCI VPS has been approved",
      "Hello,\n\n" +
        "Your VPS request has been approved. Log in to the website with your " +
        "email to reach your dashboard, which shows your SSH connection " +
        "details.\n\n" +
        `Your temporary VPS password is: ${password}\n` +
        "You will be prompted to change it the first time you log in over " +
        "SSH.\n\n" +
        "Thank you for using ALUG@UCI Community VPS Services.",
    );
  } catch (error) {
    console.error("approve: approval email failed:", error);
    warning = "Account created, but the notification email failed to send.";
  }

  return NextResponse.json({
    success: true,
    email,
    container_ip: selectedNode.address,
    warning,
  });
}
