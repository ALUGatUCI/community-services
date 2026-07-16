import "server-only";

import { createHash, randomInt, timingSafeEqual } from "crypto";

import { getSupabaseAdmin } from "./supabaseServer";

// Single-use, time-limited login codes, stored hashed in the Supabase
// `login_codes` table (see the README for the DDL).

const CODE_TTL_MINUTES = 10;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function generateCode(): string {
  // Six-digit numeric code, zero-padded.
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// Store a fresh code for the email (invalidating any previous ones) and return
// the plaintext code so the caller can email it.
export async function issueLoginCode(email: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const code = generateCode();
  const expiresAt = new Date(
    Date.now() + CODE_TTL_MINUTES * 60_000,
  ).toISOString();

  await supabase.from("login_codes").delete().eq("email", email);

  const { error } = await supabase.from("login_codes").insert({
    email,
    code_hash: hashCode(code),
    expires_at: expiresAt,
  });
  if (error) {
    throw new Error(`Failed to store login code: ${error.message}`);
  }

  return code;
}

// Verify a submitted code against the latest stored code for the email. On
// success, all of that email's codes are consumed.
export async function verifyLoginCode(
  email: string,
  code: string,
): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("login_codes")
    .select("id, code_hash, expires_at")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return false;

  const row = data[0];
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return false;
  }

  const expected = Buffer.from(row.code_hash, "hex");
  const actual = Buffer.from(hashCode(code), "hex");
  const matches =
    expected.length === actual.length && timingSafeEqual(expected, actual);

  if (matches) {
    await supabase.from("login_codes").delete().eq("email", email);
  }

  return matches;
}
