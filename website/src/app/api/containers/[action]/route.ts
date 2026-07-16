import { NextResponse } from "next/server";

import { proxyUserContainer } from "@/lib/userContainer";

// GET actions on the user's own container.
const GET_ACTIONS: Record<string, string> = {
  status: "/status",
  address: "/address",
  exists: "/exists",
};

// PUT actions (lifecycle).
const PUT_ACTIONS: Record<string, string> = {
  start: "/start",
  stop: "/stop",
  restart: "/restart",
};

type Params = { params: Promise<{ action: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { action } = await params;
  const path = GET_ACTIONS[action];
  if (!path) {
    return NextResponse.json(
      { success: false, detail: "Unknown action." },
      { status: 404 },
    );
  }
  return proxyUserContainer("GET", path);
}

export async function PUT(_request: Request, { params }: Params) {
  const { action } = await params;
  const path = PUT_ACTIONS[action];
  if (!path) {
    return NextResponse.json(
      { success: false, detail: "Unknown action." },
      { status: 404 },
    );
  }
  return proxyUserContainer("PUT", path);
}
