// Shared auth/redirect flow for the authenticated pages (login + dashboard).
// These run only in the browser (Client Components) since they navigate and
// read cookies. Requests are now anonymous and do not go through this flow.

import { authLogout, getMe } from "./api";

// Minimal shape of the App Router instance we depend on.
export type Nav = {
  push: (href: string) => void;
  replace: (href: string) => void;
};

export const routes = {
  login: "/",
  request: "/request",
  dashboard: "/dashboard",
} as const;

// A signed-in user manages their VPS on the dashboard. `pathname` guards
// against a redundant navigation (and redirect loops).
export function redirectToDashboard(router: Nav, pathname: string): void {
  if (pathname !== routes.dashboard) router.replace(routes.dashboard);
}

// Guard used by the dashboard: bounce to login if the session is invalid.
export async function validateLogin(
  router: Nav,
  pathname: string,
): Promise<void> {
  const response = await getMe();

  if (!response.ok) {
    router.replace(routes.login);
    return;
  }

  redirectToDashboard(router, pathname);
}

export async function performLogout(router: Nav): Promise<void> {
  await authLogout();
  router.push(routes.login);
}
