"use client";

import { useCallback, useEffect, useState } from "react";

import {
  adminDeleteAccount,
  adminListAccounts,
  adminSuspend,
  adminUnsuspend,
  type AdminAccount,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useUI } from "@/components/ui/feedback";

export default function AccountsPanel() {
  const { toast, confirm } = useUI();
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminListAccounts();
      if (response.ok) {
        const data = (await response.json()) as { accounts: AdminAccount[] };
        setAccounts(data.accounts);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function load() {
      await refresh();
    }
    load();
  }, [refresh]);

  async function run(
    email: string,
    action: (email: string) => Promise<Response>,
    successMsg: string,
    failMsg: string,
  ) {
    setBusy(email);
    try {
      const response = await action(email);
      const data = (await response.json()) as {
        success: boolean;
        detail?: string;
        warning?: string;
      };
      if (response.ok && data.success) {
        toast(successMsg, "success");
        if (data.warning) toast(data.warning, "info");
        await refresh();
      } else {
        toast(data.detail ?? failMsg, "error");
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(account: AdminAccount) {
    if (
      !(await confirm(
        `Delete ${account.email}? This also deletes their container and cannot be undone.`,
        { danger: true, confirmLabel: "Delete" },
      ))
    ) {
      return;
    }
    run(
      account.email,
      adminDeleteAccount,
      "Account deleted.",
      "Failed to delete the account.",
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Accounts</h2>
        <Button
          variant="secondary"
          size="sm"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {accounts.length === 0 ? (
        <p className="text-sm text-muted">
          {loading ? "Loading..." : "No accounts."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {accounts.map((account) => (
            <Card
              key={account.email}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <span className="flex flex-col">
                <strong>{account.email}</strong>
                <small className="text-muted">
                  on {account.container_ip}
                  {account.banned ? " · suspended" : ""}
                </small>
              </span>
              <span className="flex gap-2">
                {account.banned ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy === account.email}
                    onClick={() =>
                      run(
                        account.email,
                        adminUnsuspend,
                        "Account unsuspended.",
                        "Failed to unsuspend the account.",
                      )
                    }
                  >
                    Unsuspend
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy === account.email}
                    onClick={() =>
                      run(
                        account.email,
                        adminSuspend,
                        "Account suspended.",
                        "Failed to suspend the account.",
                      )
                    }
                  >
                    Suspend
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  disabled={busy === account.email}
                  onClick={() => handleDelete(account)}
                >
                  Delete
                </Button>
              </span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
