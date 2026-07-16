"use client";

import { useEffect, useState } from "react";

import { adminLogin, adminLogout, adminMe } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Page } from "@/components/ui/Page";
import { useUI } from "@/components/ui/feedback";
import AccountsPanel from "./AccountsPanel";
import NodesPanel from "./NodesPanel";
import RequestsPanel from "./RequestsPanel";

type Tab = "requests" | "accounts" | "nodes";

const TABS: { key: Tab; label: string }[] = [
  { key: "requests", label: "Requests" },
  { key: "accounts", label: "Accounts" },
  { key: "nodes", label: "Nodes" },
];

export default function AdminClient() {
  const { toast } = useUI();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [secret, setSecret] = useState("");
  const [tab, setTab] = useState<Tab>("requests");

  useEffect(() => {
    adminMe().then((response) => setAuthed(response.ok));
  }, []);

  async function handleLogin() {
    if (!secret.trim()) {
      toast("Please enter the admin secret.", "error");
      return;
    }
    const response = await adminLogin(secret.trim());
    if (response.ok) {
      setSecret("");
      setAuthed(true);
    } else {
      const data = (await response.json()) as { detail?: string };
      toast(data.detail ?? "Login failed.", "error");
    }
  }

  async function handleLogout() {
    await adminLogout();
    setAuthed(false);
  }

  if (authed === null) {
    return (
      <Page title="Admin">
        <p className="text-muted">Loading...</p>
      </Page>
    );
  }

  if (!authed) {
    return (
      <Page title="Admin login">
        <Card className="flex max-w-sm flex-col gap-4">
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleLogin();
            }}
          >
            <Field label="Admin secret" htmlFor="secret">
              <input
                id="secret"
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
              />
            </Field>
            <Button type="submit">Log in</Button>
          </form>
        </Card>
      </Page>
    );
  }

  return (
    <Page
      title="Admin"
      actions={
        <Button variant="secondary" onClick={handleLogout}>
          Log out
        </Button>
      }
    >
      <div className="flex gap-4 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className="tab"
            data-active={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "requests" && <RequestsPanel />}
      {tab === "accounts" && <AccountsPanel />}
      {tab === "nodes" && <NodesPanel />}
    </Page>
  );
}
