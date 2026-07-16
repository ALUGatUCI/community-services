"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getMe, requestCode, verifyCode } from "@/lib/api";
import { redirectToDashboard } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Page } from "@/components/ui/Page";
import { useUI } from "@/components/ui/feedback";

export default function LoginForm() {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useUI();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  // If already signed in, skip the login screen.
  useEffect(() => {
    getMe().then((response) => {
      if (response.ok) redirectToDashboard(router, pathname);
    });
  }, [router, pathname]);

  async function sendCode() {
    if (!email.trim()) {
      toast("Please enter your email address.", "error");
      return;
    }
    setBusy(true);
    try {
      const response = await requestCode(email.trim());
      const data = (await response.json()) as {
        success: boolean;
        detail?: string;
      };
      if (response.ok && data.success) {
        setStep("code");
        toast("If an account exists for that email, a login code was sent.");
      } else {
        toast(data.detail ?? "Failed to send a login code.", "error");
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitCode() {
    if (!code.trim()) {
      toast("Please enter the code from your email.", "error");
      return;
    }
    setBusy(true);
    try {
      const response = await verifyCode(email.trim(), code.trim());
      const data = (await response.json()) as {
        success: boolean;
        detail?: string;
      };
      if (response.ok && data.success) {
        redirectToDashboard(router, pathname);
      } else {
        toast(data.detail ?? "Invalid or expired code.", "error");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title="Log in" description="Sign in with your email to manage your VPS.">
      <Card className="flex max-w-sm flex-col gap-4">
        {step === "email" ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              sendCode();
            }}
          >
            <Field label="Email" htmlFor="email">
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Button type="submit" disabled={busy}>
              {busy ? "Sending..." : "Send code"}
            </Button>
          </form>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              submitCode();
            }}
          >
            <p className="text-sm text-muted">
              Enter the code sent to{" "}
              <strong className="text-foreground">{email}</strong>.
            </p>
            <Field label="Login code" htmlFor="code">
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? "Verifying..." : "Verify"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={sendCode}
                disabled={busy}
              >
                Resend code
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep("email");
                  setCode("");
                }}
                disabled={busy}
              >
                Use a different email
              </Button>
            </div>
          </form>
        )}
        <p className="text-sm text-muted">
          Need a VPS? <Link href="/request">Request one</Link>
        </p>
      </Card>
    </Page>
  );
}
