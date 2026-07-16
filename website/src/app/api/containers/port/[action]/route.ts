import { NextResponse } from "next/server";

import { proxyUserContainer } from "@/lib/userContainer";

type Params = { params: Promise<{ action: string }> };

function notFound() {
  return NextResponse.json(
    { success: false, detail: "Unknown action." },
    { status: 404 },
  );
}

export async function GET(_request: Request, { params }: Params) {
  const { action } = await params;
  if (action === "list") return proxyUserContainer("GET", "/port/list");
  if (action === "valid_ports") {
    return proxyUserContainer("GET", "/port/valid_ports");
  }
  return notFound();
}

export async function POST(request: Request, { params }: Params) {
  const { action } = await params;
  if (action !== "add") return notFound();
  const sp = new URL(request.url).searchParams;
  return proxyUserContainer("POST", "/port/add", {
    name: sp.get("name") ?? "",
    listen: sp.get("listen") ?? "",
    connect: sp.get("connect") ?? "",
  });
}

export async function DELETE(request: Request, { params }: Params) {
  const { action } = await params;
  if (action !== "delete") return notFound();
  const sp = new URL(request.url).searchParams;
  return proxyUserContainer("DELETE", "/port/delete", {
    name: sp.get("name") ?? "",
  });
}
