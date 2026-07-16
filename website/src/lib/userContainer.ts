import "server-only";

import { NextResponse } from "next/server";

import { nodeBaseUrl } from "./containerApi";
import { getSession } from "./session";
import { getSupabaseAdmin } from "./supabaseServer";

type ResolvedNode = {
  ucinetid: string;
  address: string;
  secretKey: string;
  banned: boolean;
};

// Resolve the logged-in user's container node: session email -> ucinetid, then
// account -> container_ip (node address) -> node secret_key.
async function resolveUserNode(): Promise<ResolvedNode | null> {
  const session = await getSession();
  if (!session) return null;

  const supabase = getSupabaseAdmin();
  const { data: accounts } = await supabase
    .from("accounts")
    .select("container_ip, banned")
    .eq("email", session.email)
    .limit(1);
  if (!accounts || accounts.length === 0) return null;

  const address = accounts[0].container_ip as string;
  const { data: nodes } = await supabase
    .from("nodes")
    .select("secret_key")
    .eq("address", address)
    .limit(1);
  if (!nodes || nodes.length === 0 || !nodes[0].secret_key) return null;

  return {
    ucinetid: session.email.split("@")[0],
    address,
    secretKey: nodes[0].secret_key as string,
    banned: !!accounts[0].banned,
  };
}

// Proxy a container operation to the user's node, injecting the node key and the
// user's ucinetid server-side. `path` is relative to the node's /api base, e.g.
// "/status" or "/port/add".
export async function proxyUserContainer(
  method: string,
  path: string,
  extraParams: Record<string, string> = {},
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, detail: "Not authenticated." },
      { status: 401 },
    );
  }

  const node = await resolveUserNode();
  if (!node) {
    return NextResponse.json(
      { success: false, detail: "No container found for this account." },
      { status: 404 },
    );
  }
  if (node.banned) {
    return NextResponse.json(
      { success: false, detail: "This account is suspended." },
      { status: 403 },
    );
  }

  const params = new URLSearchParams({ ucinetid: node.ucinetid, ...extraParams });
  let upstream: Response;
  try {
    upstream = await fetch(`${nodeBaseUrl(node.address)}/api${path}?${params}`, {
      method,
      headers: { "X-API-Key": node.secretKey },
    });
  } catch (error) {
    console.error(`container proxy ${method} ${path} failed:`, error);
    return NextResponse.json(
      { success: false, detail: "Could not reach the container service." },
      { status: 502 },
    );
  }

  // Pass the node's response straight through to the browser.
  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ?? "application/json",
    },
  });
}
