import "server-only";

import { getSupabaseAdmin } from "./supabaseServer";

export type NodeRecord = {
  address: string;
  secretKey: string | null;
};

// List the nodes from the Supabase `nodes` table, in a stable order so approval
// fills nodes deterministically. Each node carries its own container-api key.
export async function listNodes(): Promise<NodeRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("nodes")
    .select("address, secret_key")
    .order("address", { ascending: true });

  if (error) {
    throw new Error(`Failed to list nodes: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    address: row.address as string,
    secretKey: (row.secret_key as string | null) ?? null,
  }));
}

export type AccountNode = {
  ucinetid: string;
  address: string;
  secretKey: string;
};

// Resolve the node (address + key) hosting a given account's container, plus
// the derived ucinetid. Returns null if the account, its node, or the node's
// key is missing.
export async function getNodeForEmail(
  email: string,
): Promise<AccountNode | null> {
  const supabase = getSupabaseAdmin();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("container_ip")
    .eq("email", email)
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
    ucinetid: email.split("@")[0],
    address,
    secretKey: nodes[0].secret_key as string,
  };
}
