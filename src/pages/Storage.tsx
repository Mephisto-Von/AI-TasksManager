import { useState, useEffect } from "react";
import { HardDrive, Search, Folder, File, Trash2, Loader2 } from "lucide-react";
import { Button, Card, ProgressBar } from "../components/ui";
import { PageHeader } from "../components/PageHeader";
import { ipc, type DiskInfo, type DiskScanResult } from "../lib/ipc";
import { formatBytes } from "../lib/format";
import { open } from "@tauri-apps/plugin-dialog";

export function Storage() {
  const [disks, setDisks] = useState<DiskInfo[]>([]);
  const [scanResult, setScanResult] = useState<DiskScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"files" | "dirs">("dirs");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchDisks = async () => {
    try {
      const list = await ipc.getDisks();
      setDisks(list);
      if (list.length > 0 && !selectedPath) {
        setSelectedPath(list[0].mount_point);
      }
    } catch (e) {
      console.error("Failed to load disks", e);
    }
  };

  useEffect(() => {
    fetchDisks();
  }, []);

  const handleBrowseFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Folder to Analyze",
      });
      if (selected && typeof selected === "string") {
        setSelectedPath(selected);
      }
    } catch (e) {
      console.error("Failed to open directory dialog", e);
    }
  };

  const startScan = async () => {
    if (!selectedPath) return;
    setScanning(true);
    try {
      const res = await ipc.scanDirectory(selectedPath);
      setScanResult(res);
    } catch (e) {
      console.error("Scan failed", e);
    } finally {
      setScanning(false);
    }
  };

  const handleDelete = async (path: string) => {
    try {
      await ipc.deleteItem(path);
      // Remove item from UI lists instead of full re-scan (or trigger background updates)
      if (scanResult) {
        setScanResult({
          ...scanResult,
          top_files: scanResult.top_files.filter(f => f.path !== path),
          top_dirs: scanResult.top_dirs.filter(d => d.path !== path),
        });
      }
      setDeleteConfirm(null);
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  return (
    <>
      <PageHeader
        title="Storage Analyzer"
        subtitle="Visualize disk space distribution and instantly clean up storage."
      />

      <div className="min-h-0 flex-1 overflow-auto px-6 py-4 space-y-6">
        {/* Drive & Path Selector */}
        <Card className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-4 items-center w-full md:w-auto">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">Target Path</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={selectedPath}
                  onChange={(e) => setSelectedPath(e.target.value)}
                  className="h-8 w-64 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-fg-strong)] outline-none focus:border-[var(--color-accent)]"
                  placeholder="e.g. C:\ or C:\Users"
                />
                <Button size="sm" onClick={handleBrowseFolder}>
                  Browse
                </Button>
              </div>
            </div>

            {/* Quick Select Drives */}
            {disks.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">Quick Select Drives</label>
                <div className="flex gap-1.5">
                  {disks.map((d) => (
                    <button
                      key={d.mount_point}
                      onClick={() => setSelectedPath(d.mount_point)}
                      className={`h-8 px-2.5 rounded-md border text-xs font-medium transition-all flex items-center gap-1.5 ${
                        selectedPath === d.mount_point
                          ? "border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)] text-[var(--color-accent)]"
                          : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-fg-strong)] hover:border-[var(--color-border-strong)]"
                      }`}
                    >
                      <HardDrive className="h-3.5 w-3.5" />
                      <span>{d.mount_point}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Button variant="primary" disabled={scanning || !selectedPath} onClick={startScan} className="w-full md:w-auto">
            {scanning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Analyze Space
              </>
            )}
          </Button>
        </Card>

        {/* Drives Status */}
        {disks.length > 0 && !scanResult && !scanning && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {disks.map((d) => {
              const used = d.total_space - d.free_space;
              const usedPct = d.total_space > 0 ? (used / d.total_space) * 100 : 0;
              return (
                <Card key={d.mount_point} className="p-4 flex gap-4 items-center">
                  <div className="h-10 w-10 rounded-lg bg-[var(--color-surface-2)] flex items-center justify-center border border-[var(--color-border)]">
                    <HardDrive className="h-5 w-5 text-[var(--color-accent)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <span className="font-semibold text-sm text-[var(--color-fg-strong)]">{d.name} ({d.mount_point})</span>
                      <span className="text-xs text-[var(--color-muted)]">{d.file_system}</span>
                    </div>
                    <div className="mt-2">
                      <ProgressBar value={usedPct} tone={usedPct > 85 ? "danger" : usedPct > 70 ? "warn" : "accent"} />
                    </div>
                    <div className="flex justify-between mt-1 text-[11px] text-[var(--color-muted)]">
                      <span>{formatBytes(used)} Used</span>
                      <span>{formatBytes(d.free_space)} Free of {formatBytes(d.total_space)}</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Scanning Indicator */}
        {scanning && (
          <Card className="p-12 flex flex-col items-center justify-center text-center space-y-4">
            <Loader2 className="h-10 w-10 text-[var(--color-accent)] animate-spin" />
            <div>
              <h3 className="font-semibold text-base text-[var(--color-fg-strong)]">Analyzing Storage Directory</h3>
              <p className="text-xs text-[var(--color-muted)] mt-1">Reading folder structures, comparing sizes, and aggregating statistics...</p>
            </div>
          </Card>
        )}

        {/* Scan Results */}
        {scanResult && !scanning && (
          <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-4">
                <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">Total Size</span>
                <div className="text-2xl font-bold mt-1 text-[var(--color-accent)]">{formatBytes(scanResult.total_size)}</div>
              </Card>
              <Card className="p-4">
                <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">Total Folders</span>
                <div className="text-2xl font-bold mt-1 text-[var(--color-fg-strong)]">{scanResult.total_dirs.toLocaleString()}</div>
              </Card>
              <Card className="p-4">
                <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">Total Files</span>
                <div className="text-2xl font-bold mt-1 text-[var(--color-fg-strong)]">{scanResult.total_files.toLocaleString()}</div>
              </Card>
            </div>

            {/* File Type Stats */}
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-[var(--color-fg-strong)]">File Type Distribution</h3>
              <div className="h-4 w-full flex rounded-md overflow-hidden bg-[var(--color-surface-2)]">
                {scanResult.file_type_stats.map((stat, idx) => {
                  const pct = scanResult.total_size > 0 ? (stat.bytes / scanResult.total_size) * 100 : 0;
                  if (pct < 0.5) return null;
                  const colors = [
                    "bg-[#3b82f6]", // Video
                    "bg-[#10b981]", // Audio
                    "bg-[#f59e0b]", // Images
                    "bg-[#ec4899]", // Docs
                    "bg-[#8b5cf6]", // Archives
                    "bg-[#ef4444]", // Exe/Code
                    "bg-[#6b7280]", // Others
                  ];
                  return (
                    <div
                      key={stat.category}
                      className={colors[idx % colors.length]}
                      style={{ width: `${pct}%` }}
                      title={`${stat.category}: ${formatBytes(stat.bytes)} (${pct.toFixed(1)}%)`}
                    />
                  );
                })}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 pt-2">
                {scanResult.file_type_stats.map((stat, idx) => {
                  const pct = scanResult.total_size > 0 ? (stat.bytes / scanResult.total_size) * 100 : 0;
                  const dots = [
                    "bg-[#3b82f6]", "bg-[#10b981]", "bg-[#f59e0b]", "bg-[#ec4899]", "bg-[#8b5cf6]", "bg-[#ef4444]", "bg-[#6b7280]"
                  ];
                  return (
                    <div key={stat.category} className="flex items-center gap-2 text-xs">
                      <div className={`h-2.5 w-2.5 rounded-full ${dots[idx % dots.length]}`} />
                      <div className="min-w-0">
                        <div className="font-medium text-[var(--color-fg-strong)] truncate">{stat.category}</div>
                        <div className="text-[10px] text-[var(--color-muted)]">
                          {formatBytes(stat.bytes)} ({pct.toFixed(0)}%)
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* List details */}
            <Card className="overflow-hidden">
              <div className="flex border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
                <button
                  onClick={() => setActiveTab("dirs")}
                  className={`px-5 py-3 text-xs font-semibold border-b-2 transition-all ${
                    activeTab === "dirs"
                      ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                      : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                  }`}
                >
                  Largest Directories
                </button>
                <button
                  onClick={() => setActiveTab("files")}
                  className={`px-5 py-3 text-xs font-semibold border-b-2 transition-all ${
                    activeTab === "files"
                      ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                      : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                  }`}
                >
                  Largest Files
                </button>
              </div>

              <div className="divide-y divide-[var(--color-border)]">
                {(activeTab === "dirs" ? scanResult.top_dirs : scanResult.top_files).slice(0, 50).map((item) => (
                  <div key={item.path} className="px-4 py-3 flex items-center justify-between text-xs hover:bg-[var(--color-surface-2)] transition-colors">
                    <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
                      {item.is_dir ? (
                        <Folder className="h-4 w-4 text-[var(--color-amber)] shrink-0" />
                      ) : (
                        <File className="h-4 w-4 text-[var(--color-accent)] shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-[var(--color-fg-strong)] truncate">{item.name}</div>
                        <div className="text-[10px] text-[var(--color-muted)] truncate font-mono">{item.path}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-numeric font-medium text-[var(--color-fg-strong)] text-right">
                        {formatBytes(item.size)}
                      </span>
                      {deleteConfirm === item.path ? (
                        <div className="flex gap-1">
                          <Button size="sm" variant="danger" onClick={() => handleDelete(item.path)}>
                            Confirm Delete
                          </Button>
                          <Button size="sm" onClick={() => setDeleteConfirm(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)]"
                          onClick={() => setDeleteConfirm(item.path)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
