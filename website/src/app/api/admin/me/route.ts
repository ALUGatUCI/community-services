import { NextResponse } from "next/server";

import { hasAdminSession } from "@/lib/session";

// Used by the admin page to decide whether to show the login form or the
// dashboard.
export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ admin: false }, { status: 401 });
  }
  return NextResponse.json({ admin: true });
}
