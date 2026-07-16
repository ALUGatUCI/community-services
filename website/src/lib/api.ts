// Thin wrappers around the backend HTTP API. Every browser request sends the
// httponly auth cookie via `credentials: "include"`, matching the original site.
//
// Paths are relative so they are served by the same origin. In development the
// Next.js proxy (see next.config.ts) forwards them to the backend.

export type ContainerStatus = {
  success: boolean;
  status?: string;
};

export type ContainerAddress = {
  success: boolean;
  address?: string;
};

export type ContainerExists = {
  success: boolean;
  exists: boolean;
};

// A forward port entry as returned by the backend: [name, { listen, connect }].
export type PortEntry = [string, { listen: string; connect: string }];

export type PortsList = {
  success: boolean;
  ports: PortEntry[];
};

export type ValidPorts = {
  success: boolean;
  ports: number[];
};

export type ActionResult = {
  success: boolean;
  message?: string;
  detail?: string;
};

async function request(input: string, init?: RequestInit): Promise<Response> {
  return fetch(input, { credentials: "include", ...init });
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

// --- Auth (email-code login) ---
// These hit the Next.js route handlers under /api/auth, which manage the
// session cookie. They are same-origin, so the cookie is sent automatically.

export function requestCode(email: string): Promise<Response> {
  return fetch("/api/auth/request-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export function verifyCode(email: string, code: string): Promise<Response> {
  return fetch("/api/auth/verify-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
}

export function getMe(): Promise<Response> {
  return fetch("/api/auth/me", { method: "GET" });
}

export function authLogout(): Promise<Response> {
  return fetch("/api/auth/logout", { method: "POST" });
}

// --- Admin ---

export type AdminRequest = {
  id: number;
  email: string;
  reason: string | null;
  created_at: string;
};

export function adminMe(): Promise<Response> {
  return fetch("/api/admin/me", { method: "GET" });
}

export function adminLogin(secret: string): Promise<Response> {
  return fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret }),
  });
}

export function adminLogout(): Promise<Response> {
  return fetch("/api/admin/logout", { method: "POST" });
}

export function listRequests(): Promise<Response> {
  return fetch("/api/admin/requests", { method: "GET" });
}

export function approveRequest(requestId: number): Promise<Response> {
  return fetch("/api/admin/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request_id: requestId }),
  });
}

export function rejectRequest(requestId: number): Promise<Response> {
  return fetch("/api/admin/reject", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request_id: requestId }),
  });
}

export type AdminNode = {
  address: string;
  has_secret_key: boolean;
};

export function adminListNodes(): Promise<Response> {
  return fetch("/api/admin/nodes", { method: "GET" });
}

export function adminAddNode(
  address: string,
  secretKey: string,
): Promise<Response> {
  return fetch("/api/admin/nodes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, secret_key: secretKey }),
  });
}

export function adminUpdateNodeKey(
  address: string,
  secretKey: string,
): Promise<Response> {
  return fetch("/api/admin/nodes", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, secret_key: secretKey }),
  });
}

export function adminDeleteNode(address: string): Promise<Response> {
  const params = new URLSearchParams({ address });
  return fetch(`/api/admin/nodes?${params}`, { method: "DELETE" });
}

export function adminTestNode(address: string): Promise<Response> {
  return fetch("/api/admin/nodes/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
}

export type AdminAccount = {
  email: string;
  container_ip: string;
  banned: boolean;
  created_at: string;
};

export function adminListAccounts(): Promise<Response> {
  return fetch("/api/admin/accounts", { method: "GET" });
}

export function adminSuspend(email: string): Promise<Response> {
  return fetch("/api/admin/suspend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export function adminUnsuspend(email: string): Promise<Response> {
  return fetch("/api/admin/unsuspend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export function adminDeleteAccount(email: string): Promise<Response> {
  const params = new URLSearchParams({ email });
  return fetch(`/api/admin/accounts?${params}`, { method: "DELETE" });
}

// --- Requests ---

// Submit an anonymous VPS request. This posts to the Next.js route handler,
// which writes to Supabase — it does not go through the container backend.
export function submitRequest(
  email: string,
  reason: string,
): Promise<Response> {
  return fetch("/api/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, reason }),
  });
}

// --- Containers ---

export function containerExists(): Promise<Response> {
  return request("/api/containers/exists", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
}

export async function getAddress(): Promise<ContainerAddress> {
  const response = await request("/api/containers/address", { method: "GET" });
  return json<ContainerAddress>(response);
}

export async function getStatus(): Promise<ContainerStatus> {
  const response = await request("/api/containers/status", { method: "GET" });
  return json<ContainerStatus>(response);
}

export async function startContainer(): Promise<ActionResult> {
  const response = await request("/api/containers/start", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
  });
  return json<ActionResult>(response);
}

export async function stopContainer(): Promise<ActionResult> {
  const response = await request("/api/containers/stop", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
  });
  return json<ActionResult>(response);
}

export async function restartContainer(): Promise<ActionResult> {
  const response = await request("/api/containers/restart", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
  });
  return json<ActionResult>(response);
}

export async function listPorts(): Promise<PortsList> {
  const response = await request("/api/containers/port/list", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  return json<PortsList>(response);
}

export async function getValidPorts(): Promise<ValidPorts> {
  const response = await request("/api/containers/port/valid_ports", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  return json<ValidPorts>(response);
}

export async function addPort(
  name: string,
  listen: string,
  connect: string,
): Promise<ActionResult> {
  const params = new URLSearchParams({ name, listen, connect });
  const response = await request(`/api/containers/port/add?${params}`, {
    method: "POST",
  });
  return json<ActionResult>(response);
}

export async function deletePort(name: string): Promise<ActionResult> {
  const params = new URLSearchParams({ name });
  const response = await request(`/api/containers/port/delete?${params}`, {
    method: "DELETE",
  });
  return json<ActionResult>(response);
}

// Extract the port number from an LXD proxy address such as
// "tcp:0.0.0.0:10001" -> "10001".
export function getPortAddress(ipAddress: string): string {
  let port = ipAddress.substring(ipAddress.indexOf(":") + 1);
  port = port.substring(port.indexOf(":") + 1);
  return port;
}
