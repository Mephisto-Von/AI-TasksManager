import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, RefreshCw, Search, ShieldAlert, Sparkles, X, ChevronRight, ChevronDown, List, GitBranch } from "lucide-react";
import { Badge, Button, Card, Empty, Input } from "../components/ui";
import { PageHeader } from "../components/PageHeader";
import { ipc, type ProcessDetail, type ProcessRow } from "../lib/ipc";
import { formatBytes, formatPercent, formatRate } from "../lib/format";

type SortKey = "cpu" | "mem_bytes" | "name" | "pid" | "disk";

interface DisplayRow {
  process: ProcessRow;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
}

export function Processes(props: {
  processes: ProcessRow[];
  onAskAi: (proc: ProcessRow) => void;
  refreshHz: number;
  onManualRefresh: () => void;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("cpu");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [detail, setDetail] = useState<ProcessDetail | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "tree">("list");
  const [expandedPids, setExpandedPids] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (selectedPid == null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    ipc.processDetail(selectedPid).then((d) => {
      if (!cancelled) setDetail(d);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedPid]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key === "name");
    }
  };

  const selectedProc = useMemo(
    () => props.processes.find((p) => p.pid === selectedPid) ?? null,
    [props.processes, selectedPid]
  );

  const toggleExpand = (pid: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expandedPids);
    if (next.has(pid)) {
      next.delete(pid);
    } else {
      next.add(pid);
    }
    setExpandedPids(next);
  };

  const processedRows = useMemo(() => {
    let q = query.trim().toLowerCase();
    let list = props.processes;

    // In list mode or when searching, fallback to flat list for better user search results
    if (viewMode === "list" || q.length > 0) {
      if (q.length > 0) {
        list = list.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.pid.toString().includes(q) ||
            (p.exe ?? "").toLowerCase().includes(q)
        );
      }
      
      const sorted = [...list].sort((a, b) => {
        let av: number | string = 0;
        let bv: number | string = 0;
        switch (sortKey) {
          case "cpu": av = a.cpu; bv = b.cpu; break;
          case "mem_bytes": av = a.mem_bytes; bv = b.mem_bytes; break;
          case "name": av = a.name.toLowerCase(); bv = b.name.toLowerCase(); break;
          case "pid": av = a.pid; bv = b.pid; break;
          case "disk":
            av = a.disk_read_bps + a.disk_write_bps;
            bv = b.disk_read_bps + b.disk_write_bps;
            break;
        }
        if (av < bv) return sortAsc ? -1 : 1;
        if (av > bv) return sortAsc ? 1 : -1;
        return 0;
      });

      return sorted.map((p) => ({
        process: p,
        depth: 0,
        hasChildren: false,
        expanded: false,
      })) as DisplayRow[];
    }

    // Tree mode build logic
    const pidMap = new Map<number, { process: ProcessRow; children: any[] }>();
    props.processes.forEach((p) => {
      pidMap.set(p.pid, { process: p, children: [] });
    });

    const roots: any[] = [];
    props.processes.forEach((p) => {
      const node = pidMap.get(p.pid)!;
      if (p.parent_pid && pidMap.has(p.parent_pid)) {
        pidMap.get(p.parent_pid)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Helper to sort tree nodes
    const sortNodes = (nodes: any[]) => {
      nodes.sort((a, b) => {
        let av: number | string = 0;
        let bv: number | string = 0;
        const ap = a.process;
        const bp = b.process;
        switch (sortKey) {
          case "cpu": av = ap.cpu; bv = bp.cpu; break;
          case "mem_bytes": av = ap.mem_bytes; bv = bp.mem_bytes; break;
          case "name": av = ap.name.toLowerCase(); bv = bp.name.toLowerCase(); break;
          case "pid": av = ap.pid; bv = bp.pid; break;
          case "disk":
            av = ap.disk_read_bps + ap.disk_write_bps;
            bv = bp.disk_read_bps + bp.disk_write_bps;
            break;
        }
        if (av < bv) return sortAsc ? -1 : 1;
        if (av > bv) return sortAsc ? 1 : -1;
        return 0;
      });
      nodes.forEach((n) => {
        if (n.children.length > 0) {
          sortNodes(n.children);
        }
      });
    };

    sortNodes(roots);

    const flattened: DisplayRow[] = [];
    const traverse = (node: any, depth: number) => {
      const hasChildren = node.children.length > 0;
      const expanded = expandedPids.has(node.process.pid);
      
      flattened.push({
        process: node.process,
        depth,
        hasChildren,
        expanded,
      });

      if (hasChildren && expanded) {
        node.children.forEach((c: any) => {
          traverse(c, depth + 1);
        });
      }
    };

    roots.forEach((r) => traverse(r, 0));
    return flattened;
  }, [props.processes, query, sortKey, sortAsc, viewMode, expandedPids]);

  return (
    <>
      <PageHeader
        title="Processes"
        subtitle={`${props.processes.length} running · refreshing ${props.refreshHz}× / sec`}
        right={
          <>
            {/* View Mode Toggle */}
            <div className="flex bg-[var(--color-surface-2)] p-0.5 rounded-md border border-[var(--color-border)] mr-2">
              <button
                onClick={() => setViewMode("list")}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1 ${
                  viewMode === "list"
                    ? "bg-[var(--color-surface)] text-[var(--color-accent)] border border-[var(--color-border)] shadow-sm"
                    : "text-[var(--color-muted)] hover:text-[var(--color-fg)] border border-transparent"
                }`}
              >
                <List className="h-3.5 w-3.5" />
                List
              </button>
              <button
                onClick={() => setViewMode("tree")}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1 ${
                  viewMode === "tree"
                    ? "bg-[var(--color-surface)] text-[var(--color-accent)] border border-[var(--color-border)] shadow-sm"
                    : "text-[var(--color-muted)] hover:text-[var(--color-fg)] border border-transparent"
                }`}
              >
                <GitBranch className="h-3.5 w-3.5" />
                Tree
              </button>
            </div>

            <div className="relative w-72">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted)]" />
              <Input
                placeholder="Search by name, pid, or path"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-7"
              />
            </div>
            <Button onClick={props.onManualRefresh} variant="ghost" size="sm">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_360px]">
        <section className="min-h-0 overflow-auto px-6 py-4">
          <Card className="overflow-hidden">
            <div className="grid grid-cols-[1fr_72px_92px_104px_104px_84px_72px] items-center gap-2 border-b border-[var(--color-border)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
              <Header
                label="Process"
                active={sortKey === "name"}
                asc={sortAsc}
                onClick={() => toggleSort("name")}
              />
              <Header
                label="PID"
                active={sortKey === "pid"}
                asc={sortAsc}
                onClick={() => toggleSort("pid")}
                right
              />
              <Header
                label="CPU"
                active={sortKey === "cpu"}
                asc={sortAsc}
                onClick={() => toggleSort("cpu")}
                right
              />
              <Header
                label="Memory"
                active={sortKey === "mem_bytes"}
                asc={sortAsc}
                onClick={() => toggleSort("mem_bytes")}
                right
              />
              <Header
                label="Disk I/O"
                active={sortKey === "disk"}
                asc={sortAsc}
                onClick={() => toggleSort("disk")}
                right
              />
              <div className="text-right">Status</div>
              <div className="text-right">Trust</div>
            </div>
            <div>
              {processedRows.length === 0 ? (
                <Empty title="No matching processes" icon={Search} />
              ) : (
                processedRows.slice(0, 800).map(({ process: p, depth, hasChildren, expanded }) => {
                  const isSel = p.pid === selectedPid;
                  return (
                    <button
                      key={p.pid}
                      onClick={() => setSelectedPid(p.pid)}
                      className={
                        "grid w-full grid-cols-[1fr_72px_92px_104px_104px_84px_72px] items-center gap-2 border-b border-[var(--color-border)] px-3 py-2 text-left text-xs transition-colors " +
                        (isSel
                          ? "bg-[var(--color-surface-2)]"
                          : "hover:bg-[var(--color-surface-2)]")
                      }
                    >
                      <div className="min-w-0 flex items-center">
                        {/* Tree indentation & Expand/Collapse toggle */}
                        {viewMode === "tree" && query.trim() === "" && (
                          <div className="flex shrink-0 items-center justify-center mr-1" style={{ width: depth * 16 + 16 }}>
                            {hasChildren ? (
                              <div
                                onClick={(e) => toggleExpand(p.pid, e)}
                                className="h-4 w-4 hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded flex items-center justify-center cursor-pointer transition-colors"
                              >
                                {expanded ? (
                                  <ChevronDown className="h-3 w-3 text-[var(--color-muted)]" />
                                ) : (
                                  <ChevronRight className="h-3 w-3 text-[var(--color-muted)]" />
                                )}
                              </div>
                            ) : depth > 0 ? (
                              <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-border)] opacity-60 ml-2" />
                            ) : null}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-[var(--color-fg-strong)]">
                            {p.name}
                          </div>
                          {p.exe ? (
                            <div className="truncate text-[11px] text-[var(--color-muted)]">
                              {p.exe}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-numeric text-right text-[var(--color-muted)]">
                        {p.pid}
                      </div>
                      <div className="text-numeric text-right text-[var(--color-fg-strong)]">
                        {formatPercent(p.cpu)}
                      </div>
                      <div className="text-numeric text-right text-[var(--color-fg-strong)]">
                        {formatBytes(p.mem_bytes)}
                      </div>
                      <div className="text-numeric text-right text-[var(--color-muted)]">
                        {formatRate(p.disk_read_bps + p.disk_write_bps)}
                      </div>
                      <div className="text-right text-[var(--color-muted)]">
                        {p.status}
                      </div>
                      <div className="flex justify-end">
                        <Badge
                          tone={
                            p.threat === "red"
                              ? "red"
                              : p.threat === "yellow"
                              ? "yellow"
                              : "green"
                          }
                        >
                          {p.threat}
                        </Badge>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Card>
        </section>

        <aside className="min-h-0 overflow-auto border-l border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
          {selectedProc ? (
            <DetailPanel
              proc={selectedProc}
              detail={detail}
              onClear={() => setSelectedPid(null)}
              onKill={async () => {
                await ipc.killProcess(selectedProc.pid);
                setSelectedPid(null);
                props.onManualRefresh();
              }}
              onAskAi={() => props.onAskAi(selectedProc)}
            />
          ) : (
            <Empty
              icon={ShieldAlert}
              title="Select a process"
              description="Click any row to see live detail, trust assessment, and ask the AI for a plain-English explanation."
            />
          )}
        </aside>
      </div>
    </>
  );
}

function Header({
  label,
  active,
  asc,
  onClick,
  right,
}: {
  label: string;
  active: boolean;
  asc: boolean;
  onClick: () => void;
  right?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center gap-1 " +
        (right ? "justify-end" : "") +
        (active ? " text-[var(--color-fg-strong)]" : " text-[var(--color-muted)] hover:text-[var(--color-fg)]")
      }
    >
      <span>{label}</span>
      {active ? (
        asc ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : null}
    </button>
  );
}

function DetailPanel(props: {
  proc: ProcessRow;
  detail: ProcessDetail | null;
  onClear: () => void;
  onKill: () => void;
  onAskAi: () => void;
}) {
  const { proc, detail } = props;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-[var(--color-fg-strong)]">
            {proc.name}
          </div>
          <div className="text-xs text-[var(--color-muted)]">PID {proc.pid}</div>
        </div>
        <Button onClick={props.onClear} variant="ghost" size="sm">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge
          tone={proc.threat === "red" ? "red" : proc.threat === "yellow" ? "yellow" : "green"}
        >
          Trust: {proc.threat}
        </Badge>
        <Badge tone="neutral">{proc.status}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <Metric label="CPU" value={formatPercent(proc.cpu)} />
        <Metric label="RAM" value={formatBytes(proc.mem_bytes)} />
        <Metric label="Virtual" value={formatBytes(proc.virt_bytes)} />
        <Metric
          label="Disk I/O"
          value={formatRate(proc.disk_read_bps + proc.disk_write_bps)}
        />
        <Metric
          label="Parent"
          value={proc.parent_pid != null ? proc.parent_pid.toString() : "—"}
        />
        <Metric label="User" value={proc.user ?? "—"} />
      </div>

      {proc.exe ? (
        <Field label="Executable" value={proc.exe} mono />
      ) : null}

      {detail?.cwd ? <Field label="Working directory" value={detail.cwd} mono /> : null}
      {detail?.cmd && detail.cmd.length > 0 ? (
        <Field label="Command line" value={detail.cmd.join(" ")} mono />
      ) : null}

      <div className="flex flex-wrap gap-2 pt-2">
        <Button variant="primary" size="sm" onClick={props.onAskAi}>
          <Sparkles className="h-3.5 w-3.5" />
          Ask AI
        </Button>
        <Button variant="danger" size="sm" onClick={props.onKill}>
          <ShieldAlert className="h-3.5 w-3.5" />
          End process
        </Button>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div className="text-numeric mt-0.5 text-sm font-medium text-[var(--color-fg-strong)]">
        {value}
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div
        className={
          "mt-1 break-all rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-2 text-xs text-[var(--color-fg-strong)] " +
          (mono ? "font-mono" : "")
        }
      >
        {value}
      </div>
    </div>
  );
}
