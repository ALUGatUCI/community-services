import { NextResponse } from "next/server";

import { getAccount } from "@/lib/accounts";
import { getSession } from "@/lib/session";

// Used by the client to gate authenticated pages. A suspended account is
// treated as unauthenticated so it is bounced back to login.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const account = await getAccount(session.email);
  if (!account || account.banned) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true, email: session.email });
}
