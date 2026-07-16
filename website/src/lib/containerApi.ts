import "server-only";

// Server-to-server client for the per-node container-api (FastAPI) services.
// Each LXD node runs its own container-api, reachable at its `nodes.address` and
// authenticated with that node's own `nodes.secret_key` (sent as X-API-Key).
// Routes are mounted under /api.

// Build a node's container-api base URL from its address (from the `nodes`
// table). Scheme and port are configurable (defaults http and 8000), but the
// address may already include a scheme and/or port, in which case they are used
// as-is rather than duplicated (e.g. "1.2.3.4:8000" or "https://host:9000").
export function nodeBaseUrl(address: string): string {
  const scheme = process.env.CONTAINER_API_SCHEME ?? "http";
  const port = process.env.CONTAINER_API_PORT ?? "8000";

  const addr = address.trim();
  if (/^https?:\/\//i.test(addr)) {
    return addr.replace(/\/+$/, "");
  }
  const hasPort = /:\d+$/.test(addr);
  return `${scheme}://${addr}${hasPort ? "" : `:${port}`}`;
}

export type AtLimitResult = { reachable: boolean; atLimit: boolean };

// Ask a node whether it has reached its container limit. Unreachable nodes are
// reported as reachable:false so callers can skip them.
export async function getNodeAtLimit(
  address: string,
  secretKey: string,
): Promise<AtLimitResult> {
  try {
    const response = await fetch(`${nodeBaseUrl(address)}/api/at_limit`, {
      method: "GET",
      headers: { "X-API-Key": secretKey },
    });
    if (!response.ok) return { reachable: false, atLimit: true };
    const data = (await response.json()) as {
      success: boolean;
      atLimit: boolean;
    };
    return { reachable: true, atLimit: !!data.atLimit };
  } catch {
    return { reachable: false, atLimit: true };
  }
}

export function createContainer(
  address: string,
  secretKey: string,
  ucinetid: string,
  password: string,
): Promise<Response> {
  return fetch(`${nodeBaseUrl(address)}/api/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": secretKey,
    },
    body: JSON.stringify({ ucinetid, password }),
  });
}

export function deleteContainer(
  address: string,
  secretKey: string,
  ucinetid: string,
): Promise<Response> {
  const params = new URLSearchParams({ ucinetid });
  return fetch(`${nodeBaseUrl(address)}/api/delete?${params}`, {
    method: "DELETE",
    headers: { "X-API-Key": secretKey },
  });
}

export function suspendContainer(
  address: string,
  secretKey: string,
  ucinetid: string,
): Promise<Response> {
  const params = new URLSearchParams({ ucinetid });
  return fetch(`${nodeBaseUrl(address)}/api/suspend?${params}`, {
    method: "PUT",
    headers: { "X-API-Key": secretKey },
  });
}

export function unsuspendContainer(
  address: string,
  secretKey: string,
  ucinetid: string,
): Promise<Response> {
  const params = new URLSearchParams({ ucinetid });
  return fetch(`${nodeBaseUrl(address)}/api/unsuspend?${params}`, {
    method: "PUT",
    headers: { "X-API-Key": secretKey },
  });
}
