"use client";

import { useCallback, useEffect, useState } from "react";

import {
  approveRequest,
  listRequests,
  rejectRequest,
  type AdminRequest,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useUI } from "@/components/ui/feedback";

export default function RequestsPanel() {
  const { toast, confirm } = useUI();
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listRequests();
      if (response.ok) {
        const data = (await response.json()) as { requests: AdminRequest[] };
        setRequests(data.requests);
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

  async function handleApprove(request: AdminRequest) {
    if (!(await confirm(`Approve and provision a VPS for ${request.email}?`))) {
      return;
    }
    setBusyId(request.id);
    try {
      const response = await approveRequest(request.id);
      const data = (await response.json()) as {
        success: boolean;
        detail?: string;
        container_ip?: string;
        warning?: string;
      };
      if (response.ok && data.success) {
        toast(`Approved ${request.email} on ${data.container_ip}.`, "success");
        if (data.warning) toast(data.warning, "info");
        await refresh();
      } else {
        toast(data.detail ?? "Approval failed.", "error");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(request: AdminRequest) {
    if (
      !(await confirm(`Reject the request from ${request.email}?`, {
        danger: true,
        confirmLabel: "Reject",
      }))
    ) {
      return;
    }
    setBusyId(request.id);
    try {
      const response = await rejectRequest(request.id);
      const data = (await response.json()) as {
        success: boolean;
        detail?: string;
        warning?: string;
      };
      if (response.ok && data.success) {
        toast("Request rejected.", "success");
        if (data.warning) toast(data.warning, "info");
        await refresh();
      } else {
        toast(data.detail ?? "Rejection failed.", "error");
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Pending requests</h2>
        <Button
          variant="secondary"
          size="sm"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {requests.length === 0 ? (
        <p className="text-sm text-muted">
          {loading ? "Loading..." : "No pending requests."}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map((request) => (
            <Card key={request.id} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <strong>{request.email}</strong>
                <small className="text-muted">
                  {new Date(request.created_at).toLocaleString()}
                </small>
              </div>
              <p className="whitespace-pre-wrap text-sm">
                {request.reason ?? "(no reason provided)"}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={busyId === request.id}
                  onClick={() => handleApprove(request)}
                >
                  Approve
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={busyId === request.id}
                  onClick={() => handleReject(request)}
                >
                  Reject
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
