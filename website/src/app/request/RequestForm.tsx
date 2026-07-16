"use client";

import Link from "next/link";
import { useState } from "react";

import { submitRequest } from "@/lib/api";
import { MAX_REASON_LENGTH, validateRequest } from "@/lib/requests";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Page } from "@/components/ui/Page";
import { useUI } from "@/components/ui/feedback";

export default function RequestForm() {
  const { toast } = useUI();
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const validationError = validateRequest({ email, reason });
    if (validationError) {
      toast(validationError, "error");
      return;
    }

    setSubmitting(true);
    try {
      const response = await submitRequest(email.trim(), reason.trim());
      const data = (await response.json()) as {
        success: boolean;
        detail?: string;
      };

      if (data.success) {
        toast(
          "Request submitted. You'll get an email when it's approved.",
          "success",
        );
        setEmail("");
        setReason("");
      } else {
        toast(data.detail ?? "Failed to submit your request.", "error");
      }
    } catch (error) {
      console.error("Error submitting request:", error);
      toast("Something went wrong. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Page
      title="Request a VPS"
      description="Tell us your UCI email and why you'd like a VPS."
    >
      <Card className="flex max-w-xl flex-col gap-4">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <Field label="UCI email" htmlFor="email">
            <input
              id="email"
              type="email"
              required
              placeholder="anteater@uci.edu"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>

          <Field
            label="Reason"
            htmlFor="reason"
            hint={`${reason.length}/${MAX_REASON_LENGTH}`}
          >
            <textarea
              id="reason"
              required
              rows={8}
              maxLength={MAX_REASON_LENGTH}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>

          <Button type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit request"}
          </Button>
        </form>

        <p className="text-sm text-muted">
          Already have a VPS? <Link href="/">Log in</Link>
        </p>
      </Card>
    </Page>
  );
}
