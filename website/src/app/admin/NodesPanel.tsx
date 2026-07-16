"use client";

import { useCallback, useEffect, useState } from "react";

import {
  adminAddNode,
  adminDeleteNode,
  adminListNodes,
  adminTestNode,
  adminUpdateNodeKey,
  type AdminNode,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useUI } from "@/components/ui/feedback";

export default function NodesPanel() {
  const { toast, confirm, prompt } = useUI();
  const [nodes, setNodes] = useState<AdminNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminListNodes();
      if (response.ok) {
        const data = (await response.json()) as { nodes: AdminNode[] };
        setNodes(data.nodes);
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

  async function handleAdd() {
    if (!address.trim()) {
      toast("Enter a node address.", "error");
      return;
    }
    const response = await adminAddNode(address.trim(), secretKey.trim());
    const data = (await response.json()) as {
      success: boolean;
      detail?: string;
    };
    if (response.ok && data.success) {
      setAddress("");
      setSecretKey("");
      toast("Node added.", "success");
      await refresh();
    } else {
      toast(data.detail ?? "Failed to add node.", "error");
    }
  }

  async function handleTest(nodeAddress: string) {
    setBusy(nodeAddress);
    try {
      const response = await adminTestNode(nodeAddress);
      const data = (await response.json()) as {
        success: boolean;
        reachable?: boolean;
        atLimit?: boolean | null;
        detail?: string;
      };
      if (!response.ok || !data.success) {
        toast(data.detail ?? "Test failed.", "error");
      } else if (!data.reachable) {
        toast(
          `${nodeAddress}: unreachable or key rejected` +
            (data.detail ? ` (${data.detail})` : "") +
            ".",
          "error",
        );
      } else {
        toast(
          `${nodeAddress}: reachable. At capacity: ${data.atLimit ? "yes" : "no"}.`,
          "success",
        );
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleRotate(nodeAddress: string) {
    const key = await prompt(
      `New secret key for ${nodeAddress} (leave blank to clear):`,
      { confirmLabel: "Save key" },
    );
    if (key === null) return;
    setBusy(nodeAddress);
    try {
      const response = await adminUpdateNodeKey(nodeAddress, key.trim());
      const data = (await response.json()) as {
        success: boolean;
        detail?: string;
      };
      if (response.ok && data.success) {
        toast("Key updated.", "success");
        await refresh();
      } else {
        toast(data.detail ?? "Failed to update the key.", "error");
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(nodeAddress: string) {
    if (
      !(await confirm(`Delete node ${nodeAddress}?`, {
        danger: true,
        confirmLabel: "Delete",
      }))
    ) {
      return;
    }
    setBusy(nodeAddress);
    try {
      const response = await adminDeleteNode(nodeAddress);
      const data = (await response.json()) as {
        success: boolean;
        detail?: string;
      };
      if (response.ok && data.success) {
        toast("Node deleted.", "success");
        await refresh();
      } else {
        toast(data.detail ?? "Failed to delete the node.", "error");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Nodes</h2>
        <Button
          variant="secondary"
          size="sm"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <Card>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            handleAdd();
          }}
        >
          <label className="flex w-52 flex-col gap-1 text-sm text-muted">
            Address
            <input
              type="text"
              placeholder="10.0.0.5"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </label>
          <label className="flex w-52 flex-col gap-1 text-sm text-muted">
            Secret key
            <input
              type="password"
              value={secretKey}
              onChange={(event) => setSecretKey(event.target.value)}
            />
          </label>
          <Button type="submit">Add node</Button>
        </form>
      </Card>

      {nodes.length === 0 ? (
        <p className="text-sm text-muted">
          {loading ? "Loading..." : "No nodes configured."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {nodes.map((node) => (
            <Card
              key={node.address}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <span className="flex flex-col">
                <strong>{node.address}</strong>
                <small className="text-muted">
                  {node.has_secret_key
                    ? "key set"
                    : "no key — will be skipped"}
                </small>
              </span>
              <span className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy === node.address}
                  onClick={() => handleTest(node.address)}
                >
                  Test
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy === node.address}
                  onClick={() => handleRotate(node.address)}
                >
                  Set key
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={busy === node.address}
                  onClick={() => handleDelete(node.address)}
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
