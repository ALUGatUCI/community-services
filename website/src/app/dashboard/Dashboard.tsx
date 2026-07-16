"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  addPort,
  deletePort,
  getAddress,
  getPortAddress,
  getStatus,
  getValidPorts,
  listPorts,
  restartContainer,
  startContainer,
  stopContainer,
  type ActionResult,
  type PortEntry,
} from "@/lib/api";
import { performLogout, validateLogin } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Page } from "@/components/ui/Page";
import { useUI } from "@/components/ui/feedback";

// One row per allocated listen port. Shows the current forward target (or lets
// you set one) and, when configured, a Clear action.
function PortRow({
  listen,
  name,
  connect: initialConnect,
  busy,
  onSave,
  onClear,
}: {
  listen: number;
  name?: string;
  connect: string;
  busy: boolean;
  onSave: (listen: number, name: string | undefined, connect: string) => void;
  onClear: (name: string) => void;
}) {
  const [connect, setConnect] = useState(initialConnect);
  const configured = initialConnect !== "";

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3">
      <code className="w-16 font-medium">{listen}</code>
      <label className="flex items-center gap-2 text-sm text-muted">
        forwards to
        <input
          type="number"
          min={1}
          max={65535}
          className="w-28"
          placeholder="unused"
          value={connect}
          onChange={(event) => setConnect(event.target.value)}
        />
      </label>
      <div className="ml-auto flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => onSave(listen, name, connect)}
        >
          Save
        </Button>
        {configured && name ? (
          <Button
            variant="danger"
            size="sm"
            disabled={busy}
            onClick={() => onClear(name)}
          >
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useUI();

  const [sshAddress, setSshAddress] = useState("");
  const [status, setStatus] = useState("Unknown");
  const [ports, setPorts] = useState<PortEntry[]>([]);
  const [validPorts, setValidPorts] = useState<number[]>([]);
  const [working, setWorking] = useState(false);

  const refreshPorts = useCallback(async () => {
    try {
      const portData = await listPorts();
      if (portData.success) setPorts(portData.ports);
    } catch (error) {
      console.error(`An error occurred fetching the ports: ${error}`);
    }
    try {
      const validData = await getValidPorts();
      if (validData.success) setValidPorts(validData.ports);
    } catch (error) {
      console.error(`Retrieval of valid ports failed: ${error}`);
    }
  }, []);

  // LXD reflects device changes with a short lag, so wait briefly before
  // re-reading the ports after a modification.
  const refreshPortsSoon = useCallback(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await refreshPorts();
  }, [refreshPorts]);

  const refreshStatus = useCallback(async () => {
    try {
      const data = await getStatus();
      setStatus(data.success && data.status ? data.status : "Unknown");
    } catch (error) {
      console.error("Error fetching container status:", error);
      setStatus("Unknown");
    }
  }, []);

  useEffect(() => {
    async function load() {
      validateLogin(router, pathname);
      try {
        const data = await getAddress();
        setSshAddress(data.success && data.address ? data.address : "Unknown");
      } catch (error) {
        console.error("Error fetching SSH address:", error);
        setSshAddress("Unknown");
      }
      await refreshStatus();
      await refreshPorts();
    }
    load();
  }, [router, pathname, refreshStatus, refreshPorts]);

  useEffect(() => {
    const interval = setInterval(refreshStatus, 1500);
    return () => clearInterval(interval);
  }, [refreshStatus]);

  async function runAction(action: () => Promise<ActionResult>, verb: string) {
    setWorking(true);
    try {
      const data = await action();
      if (data.success) {
        toast(`VPS ${verb} request sent.`, "success");
      } else {
        toast(`Failed to ${verb} VPS: ${data.message ?? "unknown error"}`, "error");
      }
    } catch (error) {
      console.error(`Error during ${verb}:`, error);
      toast(`Failed to ${verb} VPS.`, "error");
    } finally {
      setWorking(false);
    }
  }

  // Map each configured proxy device to its listen port so we can show it
  // against the allocated-port list.
  const configuredByListen: Record<
    number,
    { name: string; connect: string }
  > = {};
  for (const [name, device] of ports) {
    const listen = Number(getPortAddress(device.listen));
    configuredByListen[listen] = {
      name,
      connect: getPortAddress(device.connect),
    };
  }

  const saveMapping = useCallback(
    async (listen: number, name: string | undefined, connect: string) => {
      const target = Number(connect.trim());
      if (!connect.trim() || !Number.isInteger(target) || target < 1 || target > 65535) {
        toast("Enter a port to forward to (1–65535).", "error");
        return;
      }
      setWorking(true);
      try {
        // Reuse the existing device name when editing; otherwise name it after
        // the listen port.
        const data = await addPort(name ?? String(listen), String(listen), String(target));
        toast(
          data.success
            ? `Port ${listen} now forwards to ${target}.`
            : data.detail ?? "Could not save the port.",
          data.success ? "success" : "error",
        );
        await refreshPortsSoon();
      } finally {
        setWorking(false);
      }
    },
    [toast, refreshPortsSoon],
  );

  const clearMapping = useCallback(
    async (name: string) => {
      setWorking(true);
      try {
        const data = await deletePort(name);
        toast(
          data.success ? "Port cleared." : data.detail ?? "Could not clear the port.",
          data.success ? "success" : "error",
        );
        await refreshPortsSoon();
      } finally {
        setWorking(false);
      }
    },
    [toast, refreshPortsSoon],
  );

  return (
    <Page
      title="Dashboard"
      description="Manage your VPS."
      actions={
        <Button variant="secondary" onClick={() => performLogout(router)}>
          Log out
        </Button>
      }
    >
      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Connection</h2>
        <p className="text-sm">
          Status: <span className="font-medium">{status}</span>
        </p>
        <p className="text-sm">
          SSH:{" "}
          <code className="rounded bg-background px-1.5 py-0.5">
            {sshAddress}
          </code>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={working} onClick={() => runAction(startContainer, "start")}>
            Start
          </Button>
          <Button
            variant="secondary"
            disabled={working}
            onClick={() => runAction(stopContainer, "stop")}
          >
            Stop
          </Button>
          <Button
            variant="secondary"
            disabled={working}
            onClick={() => runAction(restartContainer, "reboot")}
          >
            Reboot
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Forward ports</h2>
        <p className="text-sm text-muted">
          Each port below is reachable on the host. Set the container-side port
          it forwards to, or clear it to disable.
        </p>

        {validPorts.length === 0 ? (
          <p className="text-sm text-muted">
            No forward ports are allocated to this account.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {validPorts.map((listen) => {
              const cfg = configuredByListen[listen];
              return (
                <PortRow
                  key={`${listen}:${cfg?.connect ?? ""}`}
                  listen={listen}
                  name={cfg?.name}
                  connect={cfg?.connect ?? ""}
                  busy={working}
                  onSave={saveMapping}
                  onClear={clearMapping}
                />
              );
            })}
          </div>
        )}
      </Card>
    </Page>
  );
}
