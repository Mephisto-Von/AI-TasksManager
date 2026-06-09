import { useState, useEffect, useMemo } from "react";
import { Search, RefreshCw, Globe, Loader2 } from "lucide-react";
import { Button, Card, Empty, Input, Badge } from "../components/ui";
import { PageHeader } from "../components/PageHeader";
import { ipc, type NetworkConnection, type ProcessRow } from "../lib/ipc";

export function NetworkInspector(props: { processes: ProcessRow[] }) {
  const [connections, setConnections] = useState<NetworkConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const loadConnections = async () => {
    setLoading(true);
    try {
      const list = await ipc.getNetworkConnections();
      setConnections(list);
    } catch (e) {
      console.error("Failed to load connections", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConnections();
    const interval = setInterval(loadConnections, 4000); // refresh every 4s
    return () => clearInterval(interval);
  }, []);

  // Map PID to Process Name for display
  const pidToNameMap = useMemo(() => {
    const map = new Map<number, string>();
    props.processes.forEach((p) => {
      map.set(p.pid, p.name);
    });
    return map;
  }, [props.processes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return connections;
    return connections.filter((conn) => {
      const procName = conn.pid ? (pidToNameMap.get(conn.pid) || "").toLowerCase() : "";
      return (
        conn.protocol.toLowerCase().includes(q) ||
        conn.local_address.toLowerCase().includes(q) ||
        conn.foreign_address.toLowerCase().includes(q) ||
        conn.state.toLowerCase().includes(q) ||
        (conn.pid && conn.pid.toString().includes(q)) ||
        procName.includes(q)
      );
    });
  }, [connections, query, pidToNameMap]);

  return (
    <>
      <PageHeader
        title="Network Inspector"
        subtitle={`${connections.length} active sockets · automatic refresh 4s`}
        right={
          <>
            <div className="relative w-72">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted)]" />
              <Input
                placeholder="Search protocol, IP, port, or process"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-7"
              />
            </div>
            <Button onClick={loadConnections} variant="ghost" size="sm">
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Refresh
            </Button>
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
        {filtered.length === 0 ? (
          <Empty
            icon={Globe}
            title={loading ? "Scanning sockets..." : "No active connections matching query"}
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="grid grid-cols-[80px_1fr_1fr_120px_90px_140px] items-center gap-2 border-b border-[var(--color-border)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
              <span>Protocol</span>
              <span>Local Address</span>
              <span>Foreign Address</span>
              <span>State</span>
              <span className="text-right">PID</span>
              <span>Process</span>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {filtered.map((conn, idx) => {
                const procName = conn.pid ? pidToNameMap.get(conn.pid) : null;
                const stateColor =
                  conn.state === "ESTABLISHED"
                    ? "green"
                    : conn.state === "LISTENING"
                    ? "accent"
                    : "neutral";
                return (
                  <div
                    key={`${conn.local_address}-${conn.foreign_address}-${idx}`}
                    className="grid grid-cols-[80px_1fr_1fr_120px_90px_140px] items-center gap-2 px-3 py-2.5 text-xs hover:bg-[var(--color-surface-2)] transition-colors"
                  >
                    <div>
                      <Badge tone={conn.protocol === "TCP" ? "accent" : "neutral"}>
                        {conn.protocol}
                      </Badge>
                    </div>
                    <div className="font-mono truncate text-[var(--color-fg-strong)]">
                      {conn.local_address}
                    </div>
                    <div className="font-mono truncate text-[var(--color-muted)]">
                      {conn.foreign_address}
                    </div>
                    <div>
                      <Badge tone={stateColor}>{conn.state}</Badge>
                    </div>
                    <div className="text-numeric text-right text-[var(--color-muted)] pr-3">
                      {conn.pid || "—"}
                    </div>
                    <div className="truncate font-semibold text-[var(--color-fg-strong)]">
                      {procName || "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
