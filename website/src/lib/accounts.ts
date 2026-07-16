import "server-only";

import { getSupabaseAdmin } from "./supabaseServer";

// Normalize emails so lookups are consistent regardless of how the user typed
// them. Accounts are stored using this same normalization.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function accountExists(email: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("accounts")
    .select("email")
    .eq("email", normalizeEmail(email))
    .limit(1);

  if (error) {
    throw new Error(`Failed to look up account: ${error.message}`);
  }

  return !!data && data.length > 0;
}

export type AccountRecord = {
  email: string;
  container_ip: string;
  banned: boolean;
};

export async function getAccount(email: string): Promise<AccountRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("accounts")
    .select("email, container_ip, banned")
    .eq("email", normalizeEmail(email))
    .limit(1);

  if (error) {
    throw new Error(`Failed to look up account: ${error.message}`);
  }
  if (!data || data.length === 0) return null;

  return {
    email: data[0].email as string,
    container_ip: data[0].container_ip as string,
    banned: !!data[0].banned,
  };
}
